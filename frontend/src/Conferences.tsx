import React, { useState } from "react";
import { Redirect } from "react-router-dom";
import { Button, Paper, Typography, Grid } from "@material-ui/core";
import { createStyles, makeStyles } from "@material-ui/core/styles";

const backendUrl = '';

const useStyles = makeStyles(theme =>
  createStyles({
    root: { flexGrow: 1 },
    paper: {
      borderRadius: "20px",
      backgroundColor: "rgba(255, 255, 255, 0.6)",
      backdropFilter: "blur(5px)",
      padding: theme.spacing(4, 7),
      boxShadow: "0px 4px 20px rgba(0,0,0,0.5)"
    },
    button: {
      backgroundColor: "#fff"
    }
  })
);

const Conferences: React.FC = () => {
  const classes = useStyles();
  const [redirectTo, setRedirectTo] = useState<string>();

  const createConference = async () => {
    let resp = await fetch(`${backendUrl}/conferences`, {
      method: "POST",
      body: JSON.stringify({ name: "" }),
      headers: {
        "Content-Type": "application/json"
      }
    });

    console.log("resp", resp);

    let body = await resp.json();
    console.log("body", body);

    setRedirectTo(`/conferences/${body.id}`);
  };

  return (
    <Paper className={classes.paper}>
      <Grid container className={classes.root} spacing={2}>
        <Grid item>
          <Typography variant="h6">Create or join a conference</Typography>
        </Grid>
        <Grid container item xs={12}>
          <Grid item xs={6}>
            <Button
              id="createNewConferenceButton"
              variant="contained"
              onClick={createConference}
              className={classes.button}
            >
              Create New
            </Button>
          </Grid>
          <Grid item xs={6}>
            <Button
              variant="contained"
              onClick={createConference}
              className={classes.button}
            >
              Join Existing
            </Button>
            {redirectTo != null ? (
              <Redirect to={redirectTo}></Redirect>
            ) : (
              undefined
            )}
          </Grid>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default Conferences;
