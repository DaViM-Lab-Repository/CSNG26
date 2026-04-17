import React, { useState } from 'react';

const OpacityTable = ({setOpacities}) => {
    const [rows, setRows] = useState([
        { target: 0, alpha: 1 },
        { target: 1, alpha: 0 }
      ]);

    const handleAddRow = () => {
        const newRow = { alpha: 0, target: 100 };
        setOpacities([...rows, newRow]);
        console.log([...rows, newRow])
        setRows([...rows, newRow]);
    };

    const handleRemoveRow = (index) => {
        const newRows = rows.filter((_, i) => i !== index);
        setOpacities(newRows);
        //console.log(newRows)
        setRows(newRows);
    };

    const handleRowChange = (e, index, type) => {
        const newRows = rows.map((row, i) => {
            if (i === index) {
                return { ...row, [type]: parseFloat(e.target.value) };
            }
            return row;
        });
        setOpacities(newRows);
        setRows(newRows);
    };

    return (
        <div >
            
            <table style={{ border: '1px solid #000', padding: '10px' }}>
                <thead>
                <label>
            Relative:
            <input
                type="checkbox"
                checked={true}
                onChange={()=>{
                    //setShowPlotView(!showPlotView);
                }}
            />
            </label> <br/>
                    <tr>
                        <th>Opacity</th>
                        <th>Value</th>
                        <th><button onClick={handleAddRow}>+</button></th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, index) => (
                        <tr key={index}>
                            <td>
                                <input
                                    type="number"
                                    value={row.alpha}
                                    style={{ maxWidth: '45px' }}
                                    onChange={(e) => handleRowChange(e, index, 'alpha')}
                                />
                            </td>
                            <td>
                                <input
                                    type="number"
                                    value={row.target}
                                    style={{ maxWidth: '45px' }}
                                    onChange={(e) => handleRowChange(e, index, 'target')}
                                />
                            </td>
                            <td>
                                <button onClick={() => handleRemoveRow(index)}>-</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            
        </div>
    );
};

export default OpacityTable;
