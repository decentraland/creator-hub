import { EasingFunction } from '@dcl/ecs';
import { InterpolationType } from './enums';

/**
 * Maps an EasingFunction to the provided InterpolationType
 *
 * @param type - an InterpolationType enum type
 * @returns An EasingFunction enum type
 * @public
 */
export function getEasingFunctionFromInterpolation(type: InterpolationType): EasingFunction {
  switch (type) {
    case InterpolationType.LINEAR:
      return EasingFunction.EF_LINEAR;
    case InterpolationType.EASEINQUAD:
      return EasingFunction.EF_EASEINQUAD;
    case InterpolationType.EASEOUTQUAD:
      return EasingFunction.EF_EASEOUTQUAD;
    case InterpolationType.EASEQUAD:
      return EasingFunction.EF_EASEQUAD;
    case InterpolationType.EASEINSINE:
      return EasingFunction.EF_EASEINSINE;
    case InterpolationType.EASEOUTSINE:
      return EasingFunction.EF_EASEOUTSINE;
    case InterpolationType.EASESINE:
      return EasingFunction.EF_EASESINE;
    case InterpolationType.EASEINEXPO:
      return EasingFunction.EF_EASEINEXPO;
    case InterpolationType.EASEOUTEXPO:
      return EasingFunction.EF_EASEOUTEXPO;
    case InterpolationType.EASEEXPO:
      return EasingFunction.EF_EASEEXPO;
    case InterpolationType.EASEINELASTIC:
      return EasingFunction.EF_EASEINELASTIC;
    case InterpolationType.EASEOUTELASTIC:
      return EasingFunction.EF_EASEOUTELASTIC;
    case InterpolationType.EASEELASTIC:
      return EasingFunction.EF_EASEELASTIC;
    case InterpolationType.EASEINBOUNCE:
      return EasingFunction.EF_EASEINBOUNCE;
    case InterpolationType.EASEOUTEBOUNCE:
      return EasingFunction.EF_EASEOUTBOUNCE;
    case InterpolationType.EASEBOUNCE:
      return EasingFunction.EF_EASEBOUNCE;
    default:
      return EasingFunction.EF_LINEAR;
  }
}
