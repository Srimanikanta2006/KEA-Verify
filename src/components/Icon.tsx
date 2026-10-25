import React from 'react';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

export type IconName = React.ComponentProps<typeof MaterialIcons>['name'];
export { MaterialIcons };
export default MaterialIcons;
