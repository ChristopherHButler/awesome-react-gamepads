// import React, { useState, useEffect } from 'react';

// import useGamepads, { testArgs } from 'awesome-react-gamepads/src';
// import useGamepads from './hooks/useGamepads';
import Controller from './components/Controller';


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
