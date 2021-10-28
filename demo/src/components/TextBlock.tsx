import React from 'react';
import styled from 'styled-components';

interface TextBlockProps {
  inputLabel?: string;
  value?: number | string;
  fixed?: number;
  spaced?: boolean;
}

const TextBlock = ({ inputLabel = '', value, fixed = 2, spaced = false }: TextBlockProps) => {
  const val = (typeof value === 'number') ? value.toFixed(fixed) : value;
  return (
    <TextContainer spaced={spaced}>
      <StyledLabel>{inputLabel}</StyledLabel>
      <StyledValue>{val}</StyledValue>
    </TextContainer>
  );
};

export default TextBlock;




interface TextContainerProps {
  spaced: boolean;
}

const TextContainer = styled.div<TextContainerProps>`
  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
  margin-right: ${props => props.spaced ? '15px' : '0px'};
`;

const StyledLabel = styled.div`
  margin-left: 5px;
  font-size: 75%;
  opacity: 0.6;
  line-height: 1;
`;

const StyledValue= styled.div`
  margin-left: 5px;
  font-size: 16px;
  line-height: 1;
`;