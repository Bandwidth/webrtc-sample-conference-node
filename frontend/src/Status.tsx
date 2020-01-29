import React from "react";
import { FormControlLabel, Switch, Typography, Paper } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles(theme => ({
  loginContainer: {
    width: "100%",
    height: "100%",
    display: "flex",
    justifyContent: "center",
    alignItems: "center"
  },
  statusBox: {
    padding: theme.spacing(3, 5)
  },
  loginForm: {
    display: "flex",
    flexDirection: "column"
  },
  loginButton: {
    marginTop: theme.spacing(3)
  }
}));

type IProps = {
  online: boolean;
  onOnlineChange?: (online: boolean) => void | undefined;
};

const Status: React.FC<IProps> = props => {
  const classes = useStyles();
  return (
    <Paper className={classes.statusBox}>
      <Typography variant="h6">My status</Typography>
      <FormControlLabel
        control={
          <Switch
            color="primary"
            value="Online"
            checked={props.online}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
              if (props.onOnlineChange !== undefined) {
                props.onOnlineChange(event.target.checked);
              }
            }}
          />
        }
        label="Online"
      />
    </Paper>
  );
};

export default Status;
