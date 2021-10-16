import { useEffect, useState, useRef, useCallback } from 'react';




const useGamepads = () => {

  const [s, ss] = useState('gamepad');

  console.log('hello use effct');


  return [s];
};

export default useGamepads;