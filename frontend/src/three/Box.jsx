import React from 'react';

const Box = ({width, height, depth, color = "white", ...props}) => {
    return (
        <mesh
            {...props}
            scale={[1,1,1]}
            >
            <boxBufferGeometry attach="geometry" args={[width, height, depth]} />
            <meshPhongMaterial attach="material" color={color} />
        </mesh>

    )
}

export default Box;