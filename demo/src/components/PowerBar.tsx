import React from 'react';
import styled from 'styled-components';

interface PowerBarProps {
  value?: number;
  isRealNum?: boolean;
}

const PowerBar = ({ value = 0, isRealNum = false, }: PowerBarProps): JSX.Element => {
  const height = 35;
  const percent = isRealNum ? (Math.abs(value) * 50) : (Math.abs(value) * 100); // .35 because height is 35px
  const isNegative = isRealNum && value < 0;
  return (
    <Container height={height}>
      <Strength
        height={height}
        percent={percent}
        isRealNum={isRealNum}
        isNegative={isNegative}
        backgroundColor={"#002366"}
      />
    </Container>
  );
};

export default PowerBar;


interface ContainerProps {
  height: number;
}

const Container = styled.div<ContainerProps>`
  width: 5px;
  height: ${props => `${props.height}px`};
  background-color: rgba(25, 51, 77, 0.2);
  position: relative;
`;

interface StrengthProps {
  height: number;
  percent: number;
  isRealNum: boolean;
  isNegative: boolean;
  backgroundColor?: string;
}

const Strength = styled.div<StrengthProps>`
  display: flex;
  flex-direction: column-reverse;
  width: 5px;
  height: ${props => `${props.percent}%`};
  background-color: ${props => props.backgroundColor};
  position: absolute;
  bottom: ${props => !props.isRealNum ? 0 : props.isNegative ? 0 : `${(props.height / 2)}px`};
  top: ${props => (props.isRealNum && props.isNegative) && `${(props.height / 2)}px`};
`;