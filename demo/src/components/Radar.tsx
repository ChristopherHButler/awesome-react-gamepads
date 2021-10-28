import React from 'react';
import styled from 'styled-components';



interface RadarProps {
  xPos?: number;
  yPos?: number;
}

const Radar = ({ xPos = 0, yPos = 0 }: RadarProps) => {
  return (
    <Container>
      <svg style={{ width: "100%", height: "100%", position: "absolute", zIndex: 1 }}>
        <g transform="translate(78.5 78.5) scale(0.95, 0.95)">
          <circle cx="0" cy="0" r="78.5" fill="none" stroke="hsla(210, 50%, 20%, 0.2)" strokeWidth="1"></circle>
          <line x1="0" y1="-78.5" x2="0" y2="78.5" stroke="hsla(210, 50%, 20%, 0.2)" strokeWidth="1"></line>
          <line x1="-78.5" y1="0" x2="78.5" y2="0" stroke="hsla(210, 50%, 20%, 0.2)" strokeWidth="1"></line>
          <line x1="0" y1="0" x2={xPos * 78.5} y2={-yPos * 78.5} stroke="#19334D" strokeWidth="1"></line>
          <circle cx={xPos * 78.5} cy={-yPos * 78.5} r="4" fill="#19334D"></circle>
        </g>
      </svg>
    </Container>
  );
};

export default Radar;





const Container = styled.div`
  position: relative;
  height: 157px;
  width: 157px;
  display: inline-block;
  border: 10px solid rgba(0,0,0,0);
`;