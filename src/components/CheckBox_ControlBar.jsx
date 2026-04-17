import React from "react";

function CheckBoxControlBar({ checked, onChange, label }) {
    return (
      <div style={{display: 'flex', alignItems: 'center', paddingBottom: '10px'}}>
        <label>{label}</label>
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
        />
      </div>
    );
}

  export default CheckBoxControlBar;