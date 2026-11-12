import type { Entity } from '@dcl/sdk/ecs';
import { EnvironmentFog, Skybox, Sun, engine } from '@dcl/sdk/ecs';
import { Color3 } from '@dcl/sdk/math';

// A number edited with a slider in the Creator Hub UI: Slider<min, max, step>
type Slider<_Min extends number, _Max extends number, _Step extends number = 1> = number;

const DEG_TO_RAD = Math.PI / 180;

// The regular clouds are drawn up to twice as bright as white, so the picked colour is doubled to
// reach them: the default cloud colour is half of their midday colour.
const CLOUD_COLOR_SCALE = 2;

// The regular sky at midday. Darkening the scene with a colour's Custom option off scales these,
// as the explorer's own colours can't be read from here.
const REGULAR = {
  fog: '#508EB4',
  cloud: '#B5E5FF',
  zenith: '#3099EE',
  horizon: '#ACD3F4',
  horizonGlow: '#74C19B',
  ground: '#46CAD8',
};

/**
 * Sets the sky, ambient light, sun light and fog of the whole scene. The settings are applied while
 * the player is inside the scene. The default colours are those of the regular sky at midday; they
 * stay the same at every time of day, so you can also fix the time of day in the Scene settings.
 * Only one Skybox item should be active at a time.
 *
 * There is no separate ambient light setting: the renderer lights the scene with the sky colours.
 * For a pitch black scene, set Sun Intensity, Ambient Brightness and Star Brightness to 0.
 */
export class SkyboxController {
  private enabled = false;
  private cloudsHidden = false;
  private fogCleared = false;

  /**
   * @param startEnabled - Apply these settings as soon as the scene loads. Turn it off to apply them later with the Enable action
   * @param skyboxTexture - Image that replaces the sky: a PNG or JPG panorama in equirectangular (latitude-longitude) format, twice as wide as it is tall, e.g. 4096 x 2048. Its centre faces north (+Z) and its top edge is straight above. Cube maps and six-image skyboxes are not supported. It hides the clouds and stars; the sun, the fog and the light are unchanged, and the ambient light still follows the sky colours
   * @param sunIntensity - Strength of the sunlight and moonlight, as a multiplier: 1 is the normal strength, 0 turns it off
   * @param ambientBrightness - Darkens the light that comes from the sky, along with the sky, the clouds and the fog. 0 makes them all black. Below 1 it also darkens the regular sky and fog colours, as they look at midday, when their Custom option is off
   * @param starBrightness - Brightness of the stars, which only show at night. 0 hides them. Not used with a Skybox Texture (default: 4.62)
   * @param showSun - Show the sun and moon discs in the sky. Hiding them does not turn off their light
   * @param customFog - Replace the thickness and colour of the fog
   * @param fogDensity - How thick the fog is. Higher values hide distant objects sooner: 0.0005 is a light haze, 0.01 hides things beyond about 300 m, 1 hides everything beyond 3 m (default: 0.0005)
   * @param fogColor - Colour of the fog
   * @param fixSunPosition - Keep the sun in one place instead of following the time of day
   * @param sunHeight - How high the sun is, in degrees: 0 is on the horizon, 90 is straight above
   * @param sunDirection - Compass direction the sun shines from, in degrees: 0 is north (+Z), 90 is east (+X)
   * @param customSunColor - Replace the colour of the sunlight and moonlight. It also tints the sun disc, which then looks less bright than the regular one
   * @param sunColor - Colour of the sunlight and of the sun disc
   * @param cloudOpacity - How visible the clouds are: 0 hides them, 1 is fully opaque. Not used with a Skybox Texture (default: 1)
   * @param cloudSpeed - How fast the clouds turn around the sky. 0 keeps them still. Not used with a Skybox Texture (default: 0.01)
   * @param customSkyColors - Replace the colours of the sky. They are also the colour of the ambient light of the whole scene
   * @param cloudColor - Colour of the clouds. They are drawn twice as bright as the colour picked here, as the regular clouds are
   * @param zenithColor - Colour of the sky straight above
   * @param horizonColor - Colour of the broad band of sky around the horizon
   * @param horizonGlowColor - Colour of the narrow glow right on the horizon line, like a sunset glow
   * @param groundColor - Colour of the sky below the horizon, visible where no terrain covers it
   */
  constructor(
    public src: string, // DO NOT REMOVE
    public entity: Entity, // DO NOT REMOVE
    public startEnabled: boolean = true,
    /** @format image */
    public skyboxTexture: string = '',
    public sunIntensity: Slider<0, 5, 0.05> = 1,
    public ambientBrightness: Slider<0, 1, 0.01> = 1,
    /** @enabledIf !skyboxTexture */
    public starBrightness: Slider<0, 20, 0.01> = 4.62,
    public showSun: boolean = true,
    public customFog: boolean = true,
    /** @enabledIf customFog */
    public fogDensity: Slider<0, 1, 0.0001> = 0.0005,
    /** @enabledIf customFog */
    public fogColor: Color3 = Color3.fromHexString('#508EB4'),
    public fixSunPosition: boolean = false,
    /** @enabledIf fixSunPosition */
    public sunHeight: Slider<0, 90, 1> = 45,
    /** @enabledIf fixSunPosition */
    public sunDirection: Slider<0, 360, 1> = 135,
    public customSunColor: boolean = false,
    /** @enabledIf customSunColor */
    public sunColor: Color3 = Color3.fromHexString('#FFECAF'),
    /** @enabledIf !skyboxTexture */
    public cloudOpacity: Slider<0, 1, 0.05> = 1,
    /** @enabledIf !skyboxTexture */
    public cloudSpeed: Slider<0, 0.1, 0.005> = 0.01,
    public customSkyColors: boolean = true,
    /** @enabledIf customSkyColors */
    public cloudColor: Color3 = Color3.fromHexString('#B5E5FF'),
    /** @enabledIf customSkyColors */
    public zenithColor: Color3 = Color3.fromHexString('#3099EE'),
    /** @enabledIf customSkyColors */
    public horizonColor: Color3 = Color3.fromHexString('#ACD3F4'),
    /** @enabledIf customSkyColors */
    public horizonGlowColor: Color3 = Color3.fromHexString('#74C19B'),
    /** @enabledIf customSkyColors */
    public groundColor: Color3 = Color3.fromHexString('#46CAD8'),
  ) {}

  /**
   * Start function - called when the script is initialized
   */
  start() {
    if (this.startEnabled) this.enable();
  }

  /**
   * Apply this item's sky, sun light and fog settings
   * @action
   */
  enable() {
    this.enabled = true;
    this.apply();
  }

  /**
   * Remove this item's settings and go back to the default sky, sun light and fog
   * @action
   */
  disable() {
    this.enabled = false;
    Skybox.deleteFrom(engine.RootEntity);
    Sun.deleteFrom(engine.RootEntity);
    EnvironmentFog.deleteFrom(engine.RootEntity);
  }

  /**
   * Disable the settings if they are applied, or enable them if they are not
   * @action
   */
  toggle() {
    if (this.enabled) {
      this.disable();
    } else {
      this.enable();
    }
  }

  /**
   * Hide the clouds
   * @action
   */
  hideClouds() {
    this.cloudsHidden = true;
    this.applyIfEnabled();
  }

  /**
   * Show the clouds again after Hide Clouds
   * @action
   */
  showClouds() {
    this.cloudsHidden = false;
    this.applyIfEnabled();
  }

  /**
   * Remove the fog completely
   * @action
   */
  clearFog() {
    this.fogCleared = true;
    this.applyIfEnabled();
  }

  /**
   * Bring the fog back after Clear Fog
   * @action
   */
  restoreFog() {
    this.fogCleared = false;
    this.applyIfEnabled();
  }

  private applyIfEnabled() {
    if (this.enabled) this.apply();
  }

  private apply() {
    this.applySky();
    this.applySun();
    this.applyFog();
  }

  // The renderer derives the ambient light from the sky colours, so darkening those is the only way
  // to darken it. Darkening sends colours even with Custom Sky Colors off: the regular ones.
  private get darkened() {
    return this.ambientBrightness < 1;
  }

  private applySky() {
    const custom = this.customSkyColors;
    const skyColors = custom || this.darkened;
    Skybox.createOrReplace(engine.RootEntity, {
      skyboxTexture: this.skyboxTexture.trim() || undefined,
      skyColors: skyColors
        ? {
            zenith: this.ambient(custom ? this.zenithColor : REGULAR.zenith),
            horizon: this.ambient(custom ? this.horizonColor : REGULAR.horizon),
            rim: this.ambient(custom ? this.horizonGlowColor : REGULAR.horizonGlow),
            nadir: this.ambient(custom ? this.groundColor : REGULAR.ground),
          }
        : undefined,
      clouds: {
        opacity: this.cloudsHidden ? 0 : this.cloudOpacity,
        speed: this.cloudSpeed,
        color: skyColors
          ? this.ambient(custom ? this.cloudColor : REGULAR.cloud, CLOUD_COLOR_SCALE)
          : undefined,
      },
      stars: { brightness: this.starBrightness },
    });
  }

  private applySun() {
    if (this.sunIntensity === 1 && !this.customSunColor && this.showSun && !this.fixSunPosition) {
      Sun.deleteFrom(engine.RootEntity);
      return;
    }
    Sun.createOrReplace(engine.RootEntity, {
      color: this.customSunColor ? constant(this.sunColor) : undefined,
      intensity: this.sunIntensity,
      visible: this.showSun,
      direction: this.fixSunPosition ? this.sunLightDirection() : undefined,
    });
  }

  // The fog darkens with the ambient light: a bright fog would glow in a dark scene.
  private applyFog() {
    if (!this.customFog && !this.fogCleared && !this.darkened) {
      EnvironmentFog.deleteFrom(engine.RootEntity);
      return;
    }
    EnvironmentFog.createOrReplace(engine.RootEntity, {
      color: this.customFog
        ? this.ambient(this.fogColor)
        : this.darkened
          ? this.ambient(REGULAR.fog)
          : undefined,
      density: this.fogCleared ? 0 : this.customFog ? this.fogDensity : undefined,
    });
  }

  private ambient(color: Color3 | string, scale = 1) {
    return constant(Color3.scale(toColor3(color), this.ambientBrightness * scale));
  }

  // The light travels from the sun towards the scene, so it points away from where the sun sits.
  private sunLightDirection() {
    const height = this.sunHeight * DEG_TO_RAD;
    const heading = this.sunDirection * DEG_TO_RAD;
    return {
      x: -Math.sin(heading) * Math.cos(height),
      y: -Math.sin(height),
      z: -Math.cos(heading) * Math.cos(height),
    };
  }
}

// A single key holds the colour at every time of day. The protocol documents these colours as
// linear, but the Unity explorer uses them exactly like its own sky colours, which are authored as
// they look on screen, so the picked colour is sent unchanged to show up as picked.
function constant(color: Color3 | string) {
  const { r, g, b } = toColor3(color);
  return { keys: [{ time: 0, color: { r, g, b, a: 1 } }] };
}

// Creator Hub versions without a colour picker show colour inputs as a text box, so a typed hex code
// arrives as a string.
function toColor3(color: Color3 | string): Color3 {
  if (typeof color !== 'string') return color;
  const hex = color.trim();
  return Color3.fromHexString(hex.startsWith('#') ? hex : `#${hex}`);
}
