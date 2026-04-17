import React, { useState,useEffect } from 'react';


/**
 * `CheckBox` is a reusable React component that renders a checkbox input.
 * The checkbox's checked state is determined by the `initialChecked` prop.
 * When the checkbox is toggled, the provided `onCheck` callback is invoked with the component's `id` and its new checked state.
 *
 * @component
 * @param {string|number} id - A unique identifier for the checkbox.
 * @param {function} onCheck - A callback function that is invoked when the checkbox state is changed. It receives the checkbox's id and its new checked state as arguments.
 * @param {boolean} initialChecked - The initial checked state of the checkbox.
 */
function CheckBox({ id, onCheck,initialChecked  }) {
  const [checked, setChecked] = useState(initialChecked);

  useEffect(() => {
    setChecked(initialChecked);
  }, [initialChecked]);

  const handleChange = (event) => {
    setChecked(event.target.checked);
    onCheck(id, event.target.checked);
  };

  return (
    <input 
      type="checkbox" 
      id={id} 
      checked={checked}
      onChange={handleChange}
    />
  );
}

export default CheckBox;
