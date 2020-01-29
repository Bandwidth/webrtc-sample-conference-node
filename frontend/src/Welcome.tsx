import React from "react";
import { Box, Grid, Typography, makeStyles, Button } from "@material-ui/core";
import { FileCopy } from "@material-ui/icons";

interface WelcomeProps {
  phoneNumber?: string;
  conferenceId?: string;
}

const useStyles = makeStyles(theme => ({
  welcomeMessage: {
    alignSelf: "center",
    justifyContent: "center",
    padding: theme.spacing(20)
  }
}));

const Welcome: React.FC<WelcomeProps> = props => {
  const classes = useStyles();
  return (
    <Box className={classes.welcomeMessage}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Typography variant="h2">Hi!</Typography>
        </Grid>
        <Grid item xs={12}>
          <Typography variant="h4">
            Nobody else is here yet. Invite a friend by:
          </Typography>
        </Grid>
        <Grid item xs={6}>
          <Typography variant="h5">
            1) Sending them the link to this page
          </Typography>

          <Button
            variant="contained"
            startIcon={<FileCopy />}
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
            }}
            style={{ marginTop: "1em" }}
          >
            Copy Link
          </Button>
        </Grid>
        <Grid item xs={6}>
          <Typography variant="h5">
            2) Or, having them call: {props.phoneNumber || ""}
          </Typography>
          <Typography variant="h5">
            and entering code:
            <pre style={{ fontSize: "2em", marginTop: 0 }}>
              {props.conferenceId || ""}
            </pre>
          </Typography>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Welcome;
