import React from 'react';
import styled from 'styled-components';

import TextBlock from './TextBlock';
import InputState from './InputState';
import Radar from './Radar';

import { ReactGamepad } from '../constants';

interface GamepadAxe {
  LeftStickX: number;
  LeftStickY: number;
  RightStickX: number;
  RightStickY: number;
}



interface ControllerDashboardProps {
  gamepad?: Gamepad;
}

const ControllerDashboard = ({ gamepad }: ControllerDashboardProps) => {

  if (!gamepad) return (<div>Try connecting a gamepad.</div>);

  const { id, index, mapping, axes, buttons, } = gamepad;

  const axi = axes as unknown as GamepadAxe;
  const reactGamepad = gamepad as unknown as ReactGamepad;

  const renderedAxes = Object.entries(axes).map(([key, value]) => <InputState key={key} isRealNum inputLabel={key} value={value} fixed={4} />);
  const renderedButtons = Object.entries(buttons).map(([key, value]) => <InputState key={key} inputLabel={key} value={value.value} fixed={2} />);

  return (
    <Column>
      <h3>{id || ''}</h3>
      <Row>
        <TextBlock spaced inputLabel="INDEX" value={index} fixed={0} />
        <TextBlock spaced inputLabel="MAPPING" value={mapping} fixed={0} />
        <TextBlock spaced inputLabel="VIBRATION" value={reactGamepad?.vibrationActuator ? reactGamepad.vibrationActuator.type : 'No'} fixed={0} />
      </Row>
      <Row><h4>BUTTONS</h4></Row>
      <Row>
        {renderedButtons}
      </Row>
      <Row><h4>AXES</h4></Row>
      <Row>
        {renderedAxes}
      </Row>
      <Row>
        <Radar xPos={axi['LeftStickX']} yPos={axi['LeftStickY']} />
        <Radar xPos={axi['RightStickX']} yPos={axi['RightStickY']} />
      </Row>
    </Column>
  );
};

export default ControllerDashboard;




const Column = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const Row = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: center;
  width: 100%;
`;
