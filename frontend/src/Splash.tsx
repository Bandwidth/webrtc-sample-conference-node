import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import { Chip } from "@material-ui/core";

const useStyles = makeStyles(theme => ({
  root: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundImage:
      "url('https://live.staticflickr.com/65535/48966376551_b5e419a31b_k_d.jpg')",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundSize: "cover",
    zIndex: -1
  },
  chip: {
    position: "absolute",
    bottom: theme.spacing(2),
    left: theme.spacing(2),
    color: "#000",
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    backdropFilter: "blur(5px)"
  }
}));

const Splash: React.FC = () => {
  const classes = useStyles();
  return (
    <div className={classes.root}>
      <Chip
        className={classes.chip}
        label="Bandwidth Web Conferencing is a demo app and should not be used for production traffic"
      />
    </div>
  );
};

export default Splash;
