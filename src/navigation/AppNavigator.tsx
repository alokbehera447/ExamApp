// import React from "react";
// import { NavigationContainer } from "@react-navigation/native";
// import { createNativeStackNavigator } from "@react-navigation/native-stack";
// import LoginScreen from "../screens/LoginScreen";
// import HomeScreen from "../screens/HomeScreen";
// import ExamScreen from "../screens/ExamScreen";
// import ResultsScreen from "../screens/ResultsScreen";

// const Stack = createNativeStackNavigator();

// export default function AppNavigator() {
//   return (
//     <NavigationContainer>
//       <Stack.Navigator screenOptions={{ headerShown: false }}>
//         <Stack.Screen name="Login" component={LoginScreen} />
//         <Stack.Screen name="Home" component={HomeScreen} />
//         <Stack.Screen 
//           name="Exam" 
//           component={ExamScreen} 
//           options={{ headerShown: false }}
//         />
//         <Stack.Screen 
//           name="Results" 
//           component={ResultsScreen} 
//           options={{ headerShown: false }}
//         />
//       </Stack.Navigator>
//     </NavigationContainer>
//   );
// }



import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LoginScreen from "../screens/LoginScreen";
import HomeScreen from "../screens/HomeScreen";
import ExamScreen from "../screens/ExamScreen";
import ResultsScreen from "../screens/ResultsScreen";

// Define the parameter types for each screen
export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  Exam: { 
    attemptId: number; 
    examId: number;
    // Add any other params you pass to ExamScreen
  };
  Results: { 
    attemptId: number; 
    examTitle: string;
    // Add any other params you might pass to ResultsScreen
  };
};

// Create the navigator with typed parameters
const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="Login" 
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Exam" component={ExamScreen} />
        <Stack.Screen name="Results" component={ResultsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}