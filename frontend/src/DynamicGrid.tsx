import React from "react";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles(theme => ({
  root: {
    display: "flex",
    position: "absolute",
    flexWrap: "wrap",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#1c0a14",
    overflow: "hidden",
    justifyContent: "center"
  },
  child: {
    display: "flex",
    backgroundColor: "#1c0a14",
    overflow: "hidden",
    position: "relative",
    justifyContent: "center"
  }
}));

const DynamicGrid: React.FC = props => {
  const classes = useStyles();
  const childrenCount = React.Children.count(props.children);
  const gridWidth = Math.ceil(Math.sqrt(childrenCount));
  const gridHeight = Math.round(Math.sqrt(childrenCount));
  return (
    <div className={classes.root}>
      {React.Children.map(props.children, child => {
        return (
          <div
            className={classes.child}
            style={{
              width: `${100 / gridWidth}%`,
              height: `${100 / gridHeight}%`
            }}
          >
            {child}
          </div>
        );
      })}
    </div>
  );
};

export default DynamicGrid;
