import React from 'react';
import styled from 'styled-components';

import PowerBar from './PowerBar';
import TextBlock from './TextBlock';

interface InputStateProps {
  inputLabel?: string;
  value?: number;
  isRealNum?: boolean;
  fixed?: number;
}

const InputState = ({ inputLabel = '', value = 0.00, isRealNum = false, fixed = 2 }: InputStateProps) => {
  return (
    <Container>
      <PowerBar value={value} isRealNum={isRealNum} />
      <TextBlock inputLabel={inputLabel} value={value} fixed={fixed} />
    </Container>
  );
};

export default InputState;




const Container = styled.div`
  display: flex;
  flex-direction: row;
  margin: 10px;
`;
