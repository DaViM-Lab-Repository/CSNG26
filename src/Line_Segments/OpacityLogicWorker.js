self.onmessage = function(event) {
  const {
    opacityConfigs,
    baseOpacity,
    segmentAttributeData, // { saliency: Float32Array, averageDistance: Float32Array, ... }
    numSegments,
    opacityLogic // Added: "AND" or "OR"
  } = event.data;

  const alphaValues = new Float32Array(numSegments);

  // Helper to get min/max for an attribute array (can be optimized or pre-calculated)
  function getAttributeMinMax(attributeArray) {
    if (!attributeArray || attributeArray.length === 0) return { min: 0, max: 1 }; // Default to prevent division by zero if array is empty
    let min = attributeArray[0];
    let max = attributeArray[0];
    for (let i = 1; i < attributeArray.length; i++) {
      if (attributeArray[i] < min) min = attributeArray[i];
      if (attributeArray[i] > max) max = attributeArray[i];
    }
    // If all values are the same, min and max will be equal.
    // To prevent division by zero later, if min === max, we can adjust max slightly or handle it in the percentage calculation.
    // For now, let's return them as is and handle division by zero where segmentValuePercent is calculated.
    return { min, max };
  }

  for (let segmentGlobalIdx = 0; segmentGlobalIdx < numSegments; segmentGlobalIdx++) {
    if (!opacityConfigs || opacityConfigs.length === 0) {
      alphaValues[segmentGlobalIdx] = baseOpacity;
      continue;
    }

    let overallPass = opacityLogic === "AND"; // Initial state depends on the logic type

    for (const config of opacityConfigs) {
      const { visAttribute: currentVisAttributeForConfig, min: percentMin, max: percentMax, inverted } = config;

      if (!currentVisAttributeForConfig || currentVisAttributeForConfig === "") {
        // For AND logic, an empty/inactive config doesn't cause failure; it's skipped.
        // For OR logic, an empty/inactive config doesn't contribute to a "pass".
        continue;
      }
      
      const attributeArray = segmentAttributeData[currentVisAttributeForConfig];

      // Assume this config fails until proven otherwise
      let passesThisSpecificConfig = false;

      if (attributeArray && attributeArray.length > segmentGlobalIdx) {
        // const currentSegmentValue = attributeArray[segmentGlobalIdx]; // Saliency is pre-transformed by LineSegmentsRenderer
        // The LineSegmentsRenderer now sends transformed saliency if 'saliency' is the key.
        // The worker just uses the value as is.
        let currentSegmentValue = attributeArray[segmentGlobalIdx];

        let dataMinAttributeValue, dataMaxAttributeValue;

        if (currentVisAttributeForConfig === "saliency") {
          // Saliency is pre-transformed in LineSegmentsRenderer to be higher = more salient.
          // Its theoretical range after transformation is 0 to PI/2.
          dataMinAttributeValue = 0;
          dataMaxAttributeValue = Math.PI / 2;
        } else {
          // For other attributes, calculate min/max from the actual data.
          const attributeStats = getAttributeMinMax(attributeArray);
          dataMinAttributeValue = attributeStats.min;
          dataMaxAttributeValue = attributeStats.max;
        }

        let segmentValuePercent;
        const valueRange = dataMaxAttributeValue - dataMinAttributeValue;

        if (valueRange === 0) {
          // All values for this attribute are the same.
          // Segment passes if the user's range is 0-100 (effectively including this single point),
          // or if the range is inverted and not 0-100.
          // A common approach: if min=0 and max=100, it's within.
          // Let's use a logic similar to the original commented out code:
          // If user wants 0-100%, this point is "in".
          // If user wants e.g. 0-10%, and this point is effectively 0%, it's "in".
          // If user wants e.g. 90-100%, and this point is effectively 100%, it's "in".
          // For simplicity here: if range is 0, it passes if user range is 0-100.
          // This means segmentValuePercent should be such that it falls into a 0-100 range.
          // Let's consider it 50% to be neutral, and let the user's actualPercentMin/Max decide.
          // Or, more directly, if the value is within the user's min/max percentage of this single value.
          // If dataMin === dataMax, then currentSegmentValue is that value.
          // It passes if (percentMin <= 0 && percentMax >= 100) assuming the single value is "normalized" to be between 0 and 100.
          // A simpler check: if the value itself is what the user is looking for.
          // If the range is 0, any segment value is "at" that point.
          // It passes if the user's threshold (percentMin to percentMax) includes the point where this value would sit.
          // If all values are X, then X is 0% if percentMin is 0, or 100% if percentMax is 100.
          // Let's assume it passes if the user's range is wide (0-100), otherwise it's tricky.
          // A robust way: if range is 0, it's 0% of the range.
          // So, if user's min threshold is 0, it's in.
          segmentValuePercent = 0; // Default to 0% if all values are the same.
                                   // This means it passes if user's min threshold is 0.
                                   // Or, if inverted, it passes if user's min threshold is > 0.
        } else {
          segmentValuePercent = ((currentSegmentValue - dataMinAttributeValue) / valueRange) * 100;
        }
        
        segmentValuePercent = Math.max(0, Math.min(100, segmentValuePercent)); // Clamp

        const actualPercentMin = Math.min(percentMin, percentMax);
        const actualPercentMax = Math.max(percentMin, percentMax);
        
        const isInUserRange = segmentValuePercent >= actualPercentMin && segmentValuePercent <= actualPercentMax;
        passesThisSpecificConfig = inverted ? !isInUserRange : isInUserRange;
      }
      // If attributeArray is missing, or segmentGlobalIdx is out of bounds, passesThisSpecificConfig remains false.

      if (opacityLogic === "AND") {
        if (!passesThisSpecificConfig) {
          overallPass = false; // One fails, all fail for AND
          break; 
        }
      } else { // OR logic
        if (passesThisSpecificConfig) {
          overallPass = true; // One passes, it's enough for OR
          break; 
        }
        // If it doesn't pass, overallPass remains false (initial for OR if first config fails)
        // or keeps its current state from previous configs.
        // For OR, if all configs are processed and none passed, overallPass will be false.
      }
    } // End of for...of loop

    alphaValues[segmentGlobalIdx] = overallPass ? baseOpacity : Math.max(0.01, baseOpacity * 0.1); // Reduced opacity
  }
  // Post the array, making it transferable
  self.postMessage({ alphaValues }, [alphaValues.buffer]);
};
