import React from "react";
import {
  Box,
  TextField,
  Checkbox,
  Typography,
  MenuItem,
  Tooltip,
} from "@mui/material";
import { makeStyles } from "@mui/styles";
import { MuiColorInput } from "mui-color-input";

const useStyles = makeStyles({
  smallInput: {
    "& .MuiInputBase-root": {
      height: "30px",
      padding: "1px 1px",
      fontSize: "14px",
    },
    "& input": {
      height: "22px",
    },
  },
  label: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: "0.75rem !important",
  },
  labelContainer: {
    flex: "1 1 0",
    minWidth: 0,
  },
});

const InputWrapper = ({ label, children }) => {
  const classes = useStyles();
  return (
    <Box fullWidth alignItems="center" gap={2} sx={{ height: "30px" }}>
      <Box className={classes.labelContainer}>
        <Typography fullWidth className={classes.label}>{label}</Typography>
      </Box>
      <Box className={classes.labelContainer}>
        {children}
      </Box>
    </Box>
  );
};

export const CustomNumberInput = ({ label, value, onChange, step = 1 }) => {
  const classes = useStyles();
  
  const handleChange = (e) => {
    const newValue = e.target.value === '' ? '' : Number(e.target.value);
    onChange(newValue);
  };

  return (
    <InputWrapper label={label}>
      <TextField
        className={classes.smallInput}
        type="number"
        value={value}
        onChange={handleChange}
        fullWidth
        inputProps={{ step }}
      />
    </InputWrapper>
  );
};

export const CustomCheckBox = ({ label, checked, onChange }) => {
  const handleChange = (e) => {
    onChange(e.target.checked);
  };

  return (
    <InputWrapper label={label}>
      <Box sx={{ display: "flex", justifyContent: "center" }}>
        <Checkbox
          checked={checked}
          onChange={handleChange}
        />
      </Box>
    </InputWrapper>
  );
};

export const CustomSelect = ({ label, value, onChange, options }) => {
  const classes = useStyles();
  
  const handleChange = (e) => {
    onChange(e.target.value);
  };

  return (
    <InputWrapper label={label}>
      <Box sx={{ display: "flex", justifyContent: "center" }}>
        <TextField
          className={classes.smallInput}
          select
          value={value}
          onChange={handleChange}
          fullWidth
        >
          {options.map((option) => (
            <MenuItem
              key={option.value}
              value={option.value}
              sx={{ fontSize: "12px" }}
            >
              {option.label}
            </MenuItem>
          ))}
        </TextField>
      </Box>
    </InputWrapper>
  );
};

export const CustomColorInput = ({ label, value, onChange, tooltip = "" }) => {
  const classes = useStyles();
  
  return (
    <Box display="flex" alignItems="center" gap={2} sx={{ height: "30px", width: "100%" }}>
      <Box className={classes.labelContainer}>
        <Tooltip title={tooltip} followCursor>
          <Typography className={classes.label}>{label}</Typography>
        </Tooltip>
      </Box>
      <Box className={classes.labelContainer}>
        <MuiColorInput
          value={value}
          onChange={onChange}
          isAlphaHidden
          format="hex"
          className={classes.smallInput}
        />
      </Box>
    </Box>
  );
};
