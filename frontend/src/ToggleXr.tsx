import React from 'react'
import { createStyles, makeStyles } from "@material-ui/core/styles";
import { SvgIcon, IconButton } from '@material-ui/core';
import { mdiVirtualReality } from '@mdi/js';

const useStyles = makeStyles(theme =>
    createStyles({
        button: {
            position: 'absolute',
            right: 10,
            bottom: 10,
        }
    })
);

type IProps = {
    toggle: (event: React.MouseEvent<HTMLButtonElement>) => void,
    enabled: Boolean
};

const ToggleXr: React.FC<IProps> = ({toggle, enabled}) => {
    const styles = useStyles();
    return (
        <IconButton className={styles.button} onClick={toggle}>
            <SvgIcon color={enabled ? "secondary" : "primary" }>
                <path d={mdiVirtualReality} />
            </SvgIcon>
        </IconButton>
    )
}


export default ToggleXr;