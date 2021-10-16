import React, { useState, useEffect } from 'react';

// import useGamepads, { testArgs } from 'awesome-react-gamepads/src';
import useGamepads from './useGamepads';
import Controller from './Controller';


function App() {

  // const gamepad = useGamepads({});

  // useEffect(() => {
  //   console.log('gamepad: ', gamepad);
  // }, [gamepad]);

  return (
    <div>
      <Controller />
      {/* {testArgs()} */}
    </div>
  );
}

export default App;
