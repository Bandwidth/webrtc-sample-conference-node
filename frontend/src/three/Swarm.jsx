import React, { useMemo, useRef } from 'react';
import { Object3D } from 'three';
import { useFrame } from 'react-three-fiber';


function Swarm({ count, color }) {
    const mesh = useRef()
    const dummy = useMemo(() => new Object3D(), [])
  
    const particles = useMemo(() => {
      const temp = []
      for (let i = 0; i < count; i++) {
        const t = Math.random() * 10
        const factor = 20 + Math.random() * 100
        const speed = 0.002 + Math.random() / 400
        const xFactor = -20 + Math.random() * 40
        const yFactor = 20 + Math.random() * 40
        const zFactor = -20 + Math.random() * 40
        temp.push({ t, factor, speed, xFactor, yFactor, zFactor, mx: 0, my: 0 })
      }
      return temp
    }, [count])
  
    useFrame(state => {
      particles.forEach((particle, i) => {
        let { t, factor, speed, xFactor, yFactor, zFactor } = particle
        t = particle.t += speed / 2
        const a = Math.cos(t) + Math.sin(t * 1) / 10
        const b = Math.sin(t) + Math.cos(t * 2) / 10
        const s = Math.max(1.5, Math.cos(t) * 5)
        //particle.mx += (mouse.current[0] - particle.mx) * 0.02
        //particle.my += (-mouse.current[1] - particle.my) * 0.02
        dummy.position.set(
          (particle.mx / 10) * a + xFactor + Math.cos((t / 10) * factor) + (Math.sin(t * 1) * factor) / 10,
          (particle.my / 10) * b + yFactor + Math.sin((t / 10) * factor) + (Math.cos(t * 2) * factor) / 10,
          (particle.my / 10) * b + zFactor + Math.cos((t / 10) * factor) + (Math.sin(t * 3) * factor) / 10
        )
        dummy.scale.set(s, s, s)
        dummy.updateMatrix()
        mesh.current.setMatrixAt(i, dummy.matrix)
      })
      mesh.current.instanceMatrix.needsUpdate = true
    })
  
    return (
      <>
        <instancedMesh ref={mesh} args={[null, null, count]}>
          <sphereBufferGeometry attach="geometry" args={[1, 32, 32]} />
          <meshStandardMaterial attach="material" color={color} />
        </instancedMesh>
      </>
    )
  }


export default Swarm