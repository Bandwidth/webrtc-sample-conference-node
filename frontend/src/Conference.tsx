import React, { useState } from "react";
import DesktopConference from "./DesktopConference";
import XrConference from "./XrConference";
import ToggleXr from './ToggleXr';



const Conference = () => {
  const [ xrEnabled, setXrEnabled ] = useState(false);

  const toggleEnabled = () => {
    setXrEnabled(!xrEnabled);
  }
  return(
    <div>
      { xrEnabled ? <XrConference /> : <DesktopConference /> }
      <ToggleXr enabled={xrEnabled} toggle={toggleEnabled} />
    </div>
  )
}

export default Conference;