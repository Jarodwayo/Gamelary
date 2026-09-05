import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const DURATION = 600;

// Le splash natif (écran affiché avant même que React ne monte) ne peut pas
// être animé — c'est une image statique gérée par iOS/Android. Ce composant
// prend le relais une fois le JS prêt : il rejoue le même visuel puis le
// fait disparaître en fondu, pour éviter la coupure brutale "splash natif ->
// contenu de l'app" qu'on aurait avec SplashScreen.hideAsync() seul.
// Web n'a pas ce problème (pas de vrai splash natif), d'où le fichier
// splash-overlay.web.tsx qui ne fait rien.
export function AnimatedSplashOverlay() {
  const [animate, setAnimate] = useState(false);
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  const splashKeyframe = new Keyframe({
    0: {
      transform: [{ scale: 1 }],
      opacity: 1,
    },
    20: {
      opacity: 1,
    },
    70: {
      opacity: 0,
      easing: Easing.elastic(0.7),
    },
    100: {
      opacity: 0,
      transform: [{ scale: 1 }],
      easing: Easing.elastic(0.7),
    },
  });

  // TODO: remplacer par le logo Gamelary une fois la charte graphique prête.
  const image = <Image style={styles.image} source={require('@/assets/images/expo-logo.png')} />;

  // Machine à 2 états : d'abord un View statique identique au splash natif
  // (onLayout garantit qu'il est bien peint à l'écran avant de masquer le
  // splash natif, sinon on aurait un flash de contenu vide entre les deux) ;
  // une fois le splash natif caché, on bascule sur la version animée qui se
  // démonte elle-même (setVisible(false)) à la fin du fondu.
  return animate ? (
    <Animated.View
      entering={splashKeyframe.duration(DURATION).withCallback((finished) => {
        'worklet';
        if (finished) {
          scheduleOnRN(setVisible, false);
        }
      })}
      style={styles.splashOverlay}>
      {image}
    </Animated.View>
  ) : (
    <View
      onLayout={() => {
        SplashScreen.hideAsync().finally(() => {
          setAnimate(true);
        });
      }}
      style={styles.splashOverlay}>
      {image}
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    width: 76,
    height: 71,
  },
  splashOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#208AEF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
});
