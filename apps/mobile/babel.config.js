module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Reanimated 4 ships its worklets transform under react-native-worklets.
      // Must be the LAST plugin in the chain.
      'react-native-worklets/plugin',
    ],
  };
};
