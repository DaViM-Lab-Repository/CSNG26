import React, { useState, useRef, useEffect, useContext } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { LLMContext } from '../context/LLMContext';
import { GraphCommunitiesDataContext } from '../context/GraphCommunitiesDataContext';
import { UniversalDataContext } from '../context/UniversalDataContext';
import { GraphCommunityWorkerInstance } from '../Graph_Community/GraphCommunityWorkerInstance';
import { packSegments } from '../Segment';
import { marked } from 'marked';

// Configure marked to minimize paragraph spacing
marked.use({
  gfm: true,
  breaks: true
});

const ChatBox = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedData, setSelectedData] = useState([]);
  const [showData, setShowData] = useState(false);
  const [includeScreenshot, setIncludeScreenshot] = useState(false);
  const [isRunningCommunityDetection, setIsRunningCommunityDetection] = useState(false);
  const [loopCount, setLoopCount] = useState(0);
  const [pendingNewDetection, setPendingNewDetection] = useState(false);
  const messagesEndRef = useRef(null);

  const { 
    generateCommunitySummary, 
    generateSegmentSummary,
    generateNeighborhoodSummary,
    cleanMessage,
    adjustNeighborhoodParams,
    adjustCommunityParams,
    adjustRenderParams, // Added adjustRenderParams
    systemPrompt,
    sendCommunityResultsToLLM,
    setSendCommunityResultsToLLM
  } = useContext(LLMContext);

  const {
    dGraphData,
    communityAlgorithm,
    inputs,
    seed,
    setOrgCommunities,
    setGraphData,
    setUndoState
  } = useContext(GraphCommunitiesDataContext);

  const { segments } = useContext(UniversalDataContext);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize Gemini
  const GEMINI_API_KEY = "AIzaSyAI5IxgL7tNCEYJ-6RGx7J5xazeBN4uDcY";
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

  const callGemini = async (historyMessages, newMessageContent, imageBase64 = null) => {
    try {
      const model = genAI.getGenerativeModel({ 
        model: "gemini-3-pro-preview",
        systemInstruction: systemPrompt 
      });

      const history = historyMessages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: cleanMessage(msg.content) }]
      }));

      const chat = model.startChat({
        history: history,
      });

      const parts = [{ text: newMessageContent }];
      if (imageBase64) {
        parts.push({
          inlineData: {
            data: imageBase64,
            mimeType: "image/png"
          }
        });
      }

      const result = await chat.sendMessage(parts);
      return result.response.text();
    } catch (error) {
      console.error("Gemini API Error:", error);
      throw error;
    }
  };

  const createGraphCallback = async (event) => {
    console.log("Community detection completed, pendingNewDetection:", pendingNewDetection);
    
    setIsRunningCommunityDetection(false);
    GraphCommunityWorkerInstance.removeEventListener(
      "message",
      createGraphCallback
    );
    setOrgCommunities(event.data.communities);
    setGraphData({
      nodes: event.data.nodesWithCommunityMembers,
      links: event.data.interCommunityLinks,
    });
    setUndoState(null);

    // If we have a pending new detection, don't send results back to LLM yet
    if (pendingNewDetection) {
      console.log("Skipping LLM feedback - new detection is pending");
      setPendingNewDetection(false);
      return;
    }

    // If sendCommunityResultsToLLM is true, send results back to LLM after state updates
    console.log("send back?", sendCommunityResultsToLLM, "loop count:", loopCount);
    if (sendCommunityResultsToLLM) {
      // Check for infinite loop protection
      if (loopCount >= 10) {
        console.log("Loop limit reached, stopping automatic community detection");
        setSendCommunityResultsToLLM(false);
        setLoopCount(0);
        setMessages(prev => [
          ...prev,
          { 
            role: 'assistant', 
            content: '[Loop limit reached - stopped automatic community detection to prevent infinite loop]' 
          }
        ]);
        return;
      }

      setLoopCount(prev => prev + 1);
      
      // Wait for state updates to complete
      setTimeout(async () => {
        const communitySummary = generateCommunitySummary({
          nodes: event.data.nodesWithCommunityMembers
        }, communityAlgorithm);
        const userMessageContent = `New community detection results (iteration ${loopCount + 1}): ${communitySummary}`;
        const userMessage = { 
          role: 'user', 
          content: userMessageContent 
        };

        try {
          // Note: Automatic loop doesn't send screenshots currently
          const responseText = await callGemini(messages, userMessageContent);
          const processedContent = handleParameterAdjustments(responseText);

          setMessages(prev => [
            ...prev,
            userMessage,
            { role: 'assistant', content: processedContent }
          ]);
        } catch (error) {
          console.error('Error sending community results to LLM:', error);
          // Reset loop on error to prevent getting stuck
          setSendCommunityResultsToLLM(false);
          setLoopCount(0);
        }
      }, 0);
    }
  };

  const runCommunityDetection = (customInputs = null, customAlgorithm = null) => {
    if (!dGraphData || dGraphData.every((arr) => arr.length === 0)) return;

    console.log("Running community detection with:", {
      inputs: customInputs || inputs,
      algorithm: customAlgorithm || communityAlgorithm,
      seed: seed
    });

    setIsRunningCommunityDetection(true);
    GraphCommunityWorkerInstance.addEventListener(
      "message",
      createGraphCallback,
      false
    );
    
    GraphCommunityWorkerInstance.postMessage({
      functionType: "createGraph",
      dGraphData: dGraphData,
      segments: packSegments(segments),
      inputs: customInputs || inputs,
      communityAlgorithm: customAlgorithm || communityAlgorithm,
      seed: seed,
    });
  };

  const handleParameterAdjustments = (content) => {
    try {
      const jsonBlocks = content.match(/```json\n([\s\S]*?)\n```/g);
      if (!jsonBlocks) return content;

      let adjustedContent = content;
      let adjustedParams = [];

      for (const block of jsonBlocks) {
        try {
          const jsonStr = block.replace(/```json\n|\n```/g, '');
          const params = JSON.parse(jsonStr);

          if (params.adjustNeighborhoodParams) {
            adjustNeighborhoodParams(params.adjustNeighborhoodParams);
            adjustedParams.push('neighborhood');
          }

          if (params.adjustCommunityParams) {
            const result = adjustCommunityParams(params.adjustCommunityParams);
            adjustedParams.push('community');
            
            if (result.runDetection) {
              // Extract the new parameters from the adjustment params to pass directly
              const newInputs = { ...inputs };
              const adjustParams = params.adjustCommunityParams;
              
              if (adjustParams.resolution !== undefined && adjustParams.resolution > 0) {
                newInputs.resolution = adjustParams.resolution;
              }
              if (adjustParams.randomWalk !== undefined) {
                newInputs.randomWalk = Boolean(adjustParams.randomWalk);
              }
              if (adjustParams.min !== undefined && adjustParams.min >= 0) {
                newInputs.min = adjustParams.min;
              }
              if (adjustParams.gamma !== undefined && adjustParams.gamma >= 0 && adjustParams.gamma <= 1) {
                newInputs.gamma = adjustParams.gamma;
              }
              if (adjustParams.maxIter !== undefined && adjustParams.maxIter >= 1) {
                newInputs.max = Math.floor(adjustParams.maxIter);
              }
              if (adjustParams.dims !== undefined && adjustParams.dims >= 1) {
                newInputs.dims = Math.floor(adjustParams.dims);
              }
              if (adjustParams.kmean !== undefined && adjustParams.kmean >= 1) {
                newInputs.kmean = Math.floor(adjustParams.kmean);
              }

              const newAlgorithm = (adjustParams.algorithm && 
                ["Louvain", "Louvain-SL", "PCA K-Means", "Infomap", "Label Propagation"].includes(adjustParams.algorithm)) 
                ? adjustParams.algorithm : communityAlgorithm;

              console.log("Running detection with new parameters:", { newInputs, newAlgorithm });
              
              // Set flag to indicate we're about to run new detection
              setPendingNewDetection(true);
              
              // Run detection immediately with the new parameters instead of waiting for state updates
              setTimeout(() => runCommunityDetection(newInputs, newAlgorithm), 500);
            }
          }

          if (params.adjustRenderParams) { // Added handling for render params
            adjustRenderParams(params.adjustRenderParams);
            adjustedParams.push('rendering');
          }

          // Remove the JSON block and any preceding explanation text
          const blockStart = adjustedContent.indexOf("Here's the proposed parameter adjustment:");
          if (blockStart !== -1) {
            const explanationEnd = adjustedContent.indexOf(block) + block.length;
            adjustedContent = 
              adjustedContent.substring(0, blockStart).trim() + 
              '\n\n' + 
              adjustedContent.substring(explanationEnd).trim();
          } else {
            adjustedContent = adjustedContent.replace(block, '');
          }
        } catch (e) {
          console.error('Error parsing parameter adjustment JSON:', e);
        }
      }

      // Clean up any remaining explanation text patterns
      adjustedContent = adjustedContent
        .replace(/Here(?:'s|\s+are)\s+the\s+proposed\s+parameter\s+adjustments?:[\s\S]*?(?=\n\n|$)/, '')
        .replace(/Explanation:[\s\S]*?(?=\n\n|$)/, '')
        .replace(/\n\s*\n/g, '\n\n')
        .trim();

      if (adjustedParams.length > 0) {
        let adjustmentMessage = `[Updated ${adjustedParams.join(' & ')} parameters]`;
        if (isRunningCommunityDetection) {
          adjustmentMessage += '\n[Running community detection...]';
        }
        adjustedContent = adjustmentMessage + '\n\n' + adjustedContent;
      }

      return adjustedContent;
    } catch (e) {
      console.error('Error handling parameter adjustments:', e);
      return content;
    }
  };

  const handleDataToggle = (value) => {
    setSelectedData(prev => {
      if (prev.includes(value)) {
        return prev.filter(item => item !== value);
      } else {
        return [...prev, value];
      }
    });
  };

  const formatMessage = (content) => {
    let processedContent = content;
    if (!showData) {
      processedContent = processedContent.replace(/<<[\s\S]*?>>/g, '');
    }
    return marked.parse(processedContent);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Reset loop count when user manually sends a message
    setLoopCount(0);

    let userMessageContent = input;

    if (selectedData.length > 0) {
      const dataContent = [];
      
      if (selectedData.includes('community')) {
        dataContent.push(generateCommunitySummary());
      }
      if (selectedData.includes('segment')) {
        dataContent.push(generateSegmentSummary());
      }
      if (selectedData.includes('neighborhood')) {
        dataContent.push(generateNeighborhoodSummary());
      }

      if (dataContent.length > 0) {
        userMessageContent += ` <<${dataContent.join(' ')}>>`; 
      }
    }
    
    // Screenshot capture
    let apiImageBase64 = null;
    let displayImageSrc = null;

    if (includeScreenshot) {
        const canvas = document.querySelector('.canvas-3d-view canvas');
        if (canvas) {
            try {
                const dataURL = canvas.toDataURL('image/png');
                displayImageSrc = dataURL;
                apiImageBase64 = dataURL.replace(/^data:image\/(png|jpg);base64,/, "");
            } catch (err) {
                console.error("Error capturing screenshot:", err);
            }
        }
    }

    const userMessage = { 
        role: 'user', 
        content: userMessageContent,
        image: displayImageSrc 
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');

    try {
      setMessages(prev => [...prev, { role: 'assistant', content: '...' }]);
      
      const responseText = await callGemini(messages, userMessageContent, apiImageBase64);
      const processedContent = handleParameterAdjustments(responseText);

      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: processedContent }
      ]);
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: 'Sorry, there was an error processing your request.' }
      ]);
    }
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  const DataToggle = ({ value, label }) => (
    <div 
      onClick={() => handleDataToggle(value)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 8px',
        backgroundColor: selectedData.includes(value) ? '#007bff' : '#f8f9fa',
        color: selectedData.includes(value) ? 'white' : 'black',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '12px',
        userSelect: 'none',
        transition: 'all 0.2s ease'
      }}
    >
      {label}
    </div>
  );

  const WindowButton = ({ onClick, children }) => (
    <button 
      onClick={onClick}
      style={{
        border: 'none',
        background: 'none',
        cursor: 'pointer',
        fontSize: '20px',
        padding: '0 4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '30px',
        height: '30px'
      }}
    >
      {children}
    </button>
  );

  const messageStyle = {
    alignSelf: 'flex-start',
    backgroundColor: '#e9ecef',
    color: 'black',
    padding: '8px 12px',
    borderRadius: '15px',
    maxWidth: '80%',
    wordBreak: 'break-word',
    
    '& p': {
      margin: '0',
      padding: '0',
      lineHeight: '1.4'
    },
    '& p + p': {
      marginTop: '0.5em'
    }
  };

  const userMessageStyle = {
    ...messageStyle,
    alignSelf: 'flex-end',
    backgroundColor: '#007bff',
    color: 'white'
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      width: isMinimized ? '60px' : (isFullscreen ? '600px' : '300px'),
      height: isMinimized ? '60px' : 'calc(100vh - 115px)',
      backgroundColor: 'white',
      borderRadius: '10px',
      boxShadow: '0 0 10px rgba(0,0,0,0.1)',
      display: 'flex',
      flexDirection: 'column',
      transition: 'all 0.3s ease',
      zIndex: 1000
    }}>
      <div style={{
        padding: '10px',
        backgroundColor: '#f0f0f0',
        borderTopLeftRadius: '10px',
        borderTopRightRadius: '10px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
          {!isMinimized && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Chat with LLM</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={handleClearChat}
                    style={{
                      padding: '4px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      width: '28px',
                      height: '28px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Clear chat"
                  >
                    🗑️
                  </button>
                  <button
                    onClick={() => setShowData(!showData)}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: showData ? '#007bff' : '#f8f9fa',
                      color: showData ? 'white' : 'black',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    {showData ? 'Hide Data' : 'Show Data'}
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <DataToggle value="community" label="Community Detection" />
                <DataToggle value="segment" label="Segment Data" />
                <DataToggle value="neighborhood" label="Neighborhood Graph" />
                <div 
                  onClick={() => setIncludeScreenshot(!includeScreenshot)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    backgroundColor: includeScreenshot ? '#28a745' : '#f8f9fa',
                    color: includeScreenshot ? 'white' : 'black',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    userSelect: 'none',
                    transition: 'all 0.2s ease'
                  }}
                >
                  📸 3D View
                </div>
              </div>
            </>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {!isMinimized && (
            <WindowButton onClick={() => setIsFullscreen(!isFullscreen)}>
              {isFullscreen ? '□' : '⊞'}
            </WindowButton>
          )}
          <WindowButton onClick={() => setIsMinimized(!isMinimized)}>
            {isMinimized ? '+' : '−'}
          </WindowButton>
        </div>
      </div>

      {!isMinimized && (
        <>
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            {messages.map((msg, index) => (
              <div 
                key={`${index}-${showData}`}
                style={msg.role === 'user' ? userMessageStyle : messageStyle}
                className="markdown-content"
              >
                {msg.image && (
                  <div style={{ marginBottom: '10px' }}>
                    <img 
                      src={msg.image} 
                      alt="3D View Snapshot" 
                      style={{ 
                        maxWidth: '100%', 
                        maxHeight: '300px', 
                        borderRadius: '8px', 
                        border: '1px solid #ddd',
                        display: 'block',
                        backgroundColor: 'white'
                      }} 
                    />
                  </div>
                )}
                <div dangerouslySetInnerHTML={{
                  __html: formatMessage(msg.content)
                }} />
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSubmit} style={{
            padding: '10px',
            borderTop: '1px solid #eee'
          }}>
            <div style={{
              display: 'flex',
              gap: '10px'
            }}>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                style={{
                  flex: 1,
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '5px',
                  outline: 'none'
                }}
              />
              <button type="submit" style={{
                padding: '8px 15px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}>
                Send
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
};

export default ChatBox;
