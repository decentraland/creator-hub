/** @jsx ReactEcs.createElement */
import {
  AvatarShape,
  EasingFunction,
  engine,
  Entity,
  InputAction,
  inputSystem,
  Name,
  PointerEventType,
  PointerEvents,
  pointerEventsSystem,
  Schemas,
  Transform,
  Tween,
  tweenSystem,
} from '@dcl/sdk/ecs';
import { Vector3, Color4, Quaternion } from '@dcl/sdk/math';
import ReactEcs, { Input, UiEntity, ReactEcsRenderer } from '@dcl/sdk/react-ecs';
import { openExternalUrl } from '~system/RestrictedActions';
import { getRealm, PBRealmInfo } from '~system/Runtime';
import { signedFetch } from '~system/SignedFetch';
import { getUserData } from '~system/UserIdentity';
import { ActionCallback } from '~sdk/script-utils';
import { getEntitiesWithParent } from '@dcl/asset-packs/dist/helpers';

const REWARDS_TESTING_ENABLED = false;
const REWARDS_SERVER = REWARDS_TESTING_ENABLED
  ? 'https://rewards.decentraland.zone'
  : 'https://rewards.decentraland.org';

enum UiType {
  NONE,
  WAITING,
  CAPTCHA,
  ERROR,
  CAMPAIGN_NOT_STARTED,
  CAMPAIGN_ENDED,
  ALREADY_CLAIM,
  SUCCESS,
}

const SpinnerComponent = engine.defineComponent('claim-reward-spinner', {
  angle: Schemas.Number,
  speed: Schemas.Number,
});

export class ClaimRewardButton {
  private uiVisible = false;
  private activeUi: UiType = UiType.NONE;
  private uiEntity!: Entity;
  private errorText = '';
  private errorDetails: string | null = null;
  private showErrorDetails = false;
  private errorTitleText: string | null = null;
  private errorBodyText: string | null = null;
  private notStartedTitleText = '';
  private notStartedDescText = '';
  private thumbnail: string | null = null;
  private captchaId: string | null = null;
  private captchaImage: string | null = null;
  private captchaText: string = '';
  private buttonSystemAdded = false;
  private wearableEntity!: Entity;
  private lastRequestWasLocalPreview = false;
  private waitingSpinner!: Entity;

  private userData: any;
  private inTimeout = false;
  private alreadyClaimedKeys: string[] = [];

  private startDateParsed?: Date;
  private endDateParsed?: Date;

  /**
   * @param campaignId - The ID of a campaign on decentraland.org/rewards
   * @param dispenserKey - The dispenser key of a dispenser in a campaign on decentraland.org/rewards
   * @param wearableURN - The URN for the wearable to display floating in the dispenser
   * @param startDate - The start date of the campaign in YYYY-MM-DD format
   * @param endDate - The end date of the campaign in YYYY-MM-DD format
   * @param wearableYOffset - How many meters above the ground the wearable should be displayed
   * @param hoverText - The text shown before clicking the dispenser
   * @param ActivateOnSuccess - Trigger an action from another smart item when the claim is successful (e.g. confetti or balloons).
   */
  constructor(
    public src: string,
    public entity: Entity,
    public campaignId: string,
    public dispenserKey: string,
    public wearableURN: string = 'urn:decentraland:off-chain:base-avatars:green_hoodie',
    public startDate?: string,
    public endDate?: string,
    public wearableYOffset: number = 0.5,
    // Optional: override hover text shown on click
    public hoverText: string = 'Claim',
    // Optional: action callback triggered when SUCCESS UI is shown
    public ActivateOnSuccess?: ActionCallback,
  ) {
    this.campaignId = campaignId;
    this.dispenserKey = dispenserKey;

    this.startDateParsed = parseCampaignStartDate(startDate);
    this.endDateParsed = parseCampaignEndDate(endDate);

    if (startDate && !this.startDateParsed) {
      console.log(`[ClaimReward] Could not parse startDate: "${startDate}"`);
    }
    if (endDate && !this.endDateParsed) {
      console.log(`[ClaimReward] Could not parse endDate: "${endDate}"`);
    }
  }

  start() {
    this.initUi();
    ReactEcsRenderer.addUiRenderer(this.entity, () => this.createDispenserUi(), {
      virtualWidth: 1920,
      virtualHeight: 1080,
    });

    this.initSpinner();
    this.displayWearable();

    // Use the child entity whose Name starts with "Button" as the click target (instead of this.entity).
    const children = getEntitiesWithParent(this.entity);
    let buttonEntity: Entity | null = null;
    for (const childEntity of children) {
      const nameComponent = Name.getOrNull(childEntity);
      if (nameComponent?.value?.startsWith('Button')) {
        if (buttonEntity) {
          console.error(
            `[ClaimRewardButton] Multiple child entities found with name starting with "Button". Expected exactly one. Using the first match.`,
          );
          break;
        }
        buttonEntity = childEntity;
      }
    }
    if (!buttonEntity) {
      console.error(
        `[ClaimRewardButton] No child entity found with name starting with "Button". Falling back to click on root entity.`,
      );
    }

    pointerEventsSystem.onPointerDown(
      {
        entity: buttonEntity ?? this.entity,
        opts: {
          button: InputAction.IA_PRIMARY,
          hoverText: this.hoverText ?? 'Claim',
        },
      },
      () => {
        void this.claim();
      },
    );
  }

  update(_dt: number) {}

  private initSpinner() {
    this.waitingSpinner = engine.addEntity();
    SpinnerComponent.create(this.waitingSpinner, { angle: 0, speed: 250 });

    engine.addSystem(
      (dt: number) => {
        if (this.activeUi !== UiType.WAITING) return;
        const s = SpinnerComponent.getMutable(this.waitingSpinner);
        s.angle -= dt * s.speed;
        if (s.angle < 0) s.angle += 360;
      },
      undefined,
      `claim-reward-spinner-${this.entity}`,
    );
  }

  public displayWearable() {
    const wearableParent = engine.addEntity();
    Transform.create(wearableParent, {
      position: Vector3.create(0, 0, 0),
      parent: this.entity,
    });

    Tween.setRotateContinuous(wearableParent, Quaternion.fromEulerDegrees(0, -90, 0), 10, 0);

    this.wearableEntity = engine.addEntity();
    AvatarShape.create(this.wearableEntity, {
      id: '',
      emotes: [],
      wearables: [this.wearableURN],
      showOnlyWearables: true,
    });

    Transform.create(this.wearableEntity, {
      position: Vector3.create(0, this.wearableYOffset, 0),
      parent: wearableParent,
    });
  }

  /**
   * @action Claim the reward
   */
  public async claim() {
    if (this.inTimeout) return;
    this.inTimeout = true;
    setTimeout(() => (this.inTimeout = false), 3000);

    // Reset any previous captcha attempt
    this.captchaId = null;
    this.captchaImage = null;
    this.captchaText = '';

    if (this.alreadyClaimedKeys.find(k => k === this.dispenserKey)) {
      this.alreadyClaimedUi();
      return;
    }

    // Preflight: don't even hit Rewards server if campaign is not active.
    if (this.startDateParsed && this.isCampaignEarly()) {
      this.notStartedUi(this.startDateParsed);
      return;
    }
    if (this.endDateParsed && this.isCampaignLate()) {
      this.endedUi(this.endDateParsed);
      return;
    }

    const ok = await this.setUserData();
    if (!ok) return;

    this.waitingUi();
    await this.requestToken();
  }

  // Internal: SDK systems and UI
  private initUi() {
    this.uiEntity = engine.addEntity();
    Transform.create(this.uiEntity, { scale: Vector3.create(0, 0, 0) });
  }

  private createDispenserUi() {
    const anim = Transform.getOrNull(this.uiEntity)?.scale?.x ?? 0;
    return (
      <UiEntity
        key={'ui-root'}
        uiTransform={{
          display: this.uiVisible ? 'flex' : 'none',
          width: '100%',
          height: '100%',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          positionType: 'absolute',
          overflow: 'hidden',
          opacity: anim,
        }}
      >
        <UiEntity
          key={'ui-background'}
          uiTransform={{
            display: this.uiVisible ? 'flex' : 'none',
            width: 512,
            height: 512,
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            positionType: 'absolute',
            // Tiny slide-in adds a bit of motion (no responsive scaling hack)
            position: { top: (1 - anim) * 12 },
          }}
          uiBackground={{
            // Generic background (no event branding)
            texture: { src: this.src + '/images/WearablePopUp_Background.png' },
            textureMode: 'stretch',
          }}
        >
          <UiEntity
            key={'ui-error'}
            uiTransform={{
              display: this.activeUi === UiType.ERROR ? 'flex' : 'none',
              width: 640 * 0.8 * 0.8,
              height: 510 * 0.8 * 0.8,
              flexDirection: 'column',
              justifyContent: this.showErrorDetails && this.errorDetails ? 'flex-start' : 'center',
              alignItems: 'center',
              margin: { top: 20 },
              positionType: 'absolute',
            }}
          >
            <UiEntity
              key={'ui-error-text'}
              uiTransform={{
                display: 'flex',
                width: '100%',
                height: this.showErrorDetails && this.errorDetails ? 140 : 280,
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                positionType: 'relative',
                overflow: 'hidden',
              }}
            >
              <UiEntity
                key={'ui-error-title'}
                uiTransform={{
                  display: 'flex',
                  width: '96%',
                  height: this.errorBodyText ? 110 : '100%',
                  justifyContent: 'center',
                  alignItems: 'center',
                  positionType: this.errorBodyText ? 'absolute' : 'relative',
                  position: this.errorBodyText ? { top: 0, left: 0 } : undefined,
                  overflow: this.errorBodyText ? 'hidden' : 'visible',
                }}
                uiText={{
                  value: this.errorTitleText ?? this.errorText,
                  fontSize: this.errorBodyText
                    ? 28
                    : this.showErrorDetails && this.errorDetails
                      ? 22
                      : 24,
                  textAlign: 'middle-center',
                  textWrap: 'wrap',
                }}
              />

              <UiEntity
                key={'ui-error-body'}
                uiTransform={{
                  // When details are open, hide the short body to avoid visual duplication/peeking.
                  display:
                    this.errorBodyText && !(this.showErrorDetails && this.errorDetails)
                      ? 'flex'
                      : 'none',
                  width: '96%',
                  height: 160,
                  justifyContent: 'center',
                  alignItems: 'center',
                  positionType: 'absolute',
                  position: { top: 120, left: 0 },
                  overflow: 'hidden',
                }}
                uiText={{
                  value: this.errorBodyText ?? '',
                  fontSize: 18,
                  textAlign: 'middle-center',
                  textWrap: 'wrap',
                }}
              />
            </UiEntity>

            <UiEntity
              key={'ui-error-details-frame'}
              uiTransform={{
                display: this.showErrorDetails && this.errorDetails ? 'flex' : 'none',
                width: 470,
                height: 190,
                justifyContent: 'center',
                alignContent: 'center',
                alignSelf: 'center',
                positionType: 'relative',
                margin: { top: 8 },
                overflow: 'hidden',
              }}
              uiBackground={{
                texture: { src: this.src + '/images/frame.png' },
                textureMode: 'nine-slices',
              }}
            >
              <UiEntity
                key={'ui-error-details-text'}
                uiTransform={{
                  display: 'flex',
                  width: '92%',
                  height: '90%',
                  positionType: 'absolute',
                  position: { top: 10, left: 12 },
                  overflow: 'hidden',
                }}
                uiText={{
                  value: this.errorDetails ?? '',
                  fontSize: 14,
                  textAlign: 'top-left',
                  textWrap: 'wrap',
                }}
              />
            </UiEntity>

            <UiEntity
              key={'ui-error-details-button'}
              uiTransform={{
                display: this.errorDetails ? 'flex' : 'none',
                width: 260,
                height: 74,
                flexDirection: 'column',
                justifyContent: 'center',
                alignContent: 'center',
                alignSelf: 'center',
                positionType: 'relative',
                margin: { top: 10 },
              }}
              uiBackground={{
                texture: { src: this.src + '/images/ok_button_empty.png' },
                textureMode: 'stretch',
              }}
            >
              <UiEntity
                key={'ui-error-details-button-text'}
                uiTransform={{
                  display: 'flex',
                  width: '100%',
                  height: '100%',
                  positionType: 'absolute',
                  position: { top: 0, left: 0 },
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
                uiBackground={{ color: Color4.create(0, 1, 0, 0) }}
                uiText={{
                  value: this.showErrorDetails ? '<b>HIDE DETAILS</b>' : '<b>SEE DETAILS</b>',
                  fontSize: 18,
                  textAlign: 'middle-center',
                }}
                onMouseDown={() => (this.showErrorDetails = !this.showErrorDetails)}
              />
            </UiEntity>
          </UiEntity>

          <UiEntity
            key={'ui-not-active'}
            uiTransform={{
              display:
                this.activeUi === UiType.CAMPAIGN_NOT_STARTED ||
                this.activeUi === UiType.CAMPAIGN_ENDED
                  ? 'flex'
                  : 'none',
              width: 512 * 0.8,
              height: 512 * 0.8,
              justifyContent: 'center',
              alignContent: 'center',
              margin: { top: 20 },
              positionType: 'absolute',
            }}
          >
            <UiEntity
              key={'ui-not-active-text-one'}
              uiTransform={{
                display: 'flex',
                width: '100%',
                height: 40,
                positionType: 'absolute',
                position: { top: 40 },
              }}
              uiText={{
                value: this.notStartedTitleText,
                fontSize: 34,
              }}
            />
            <UiEntity
              key={'ui-not-active-frame'}
              uiTransform={{
                display: 'flex',
                width: 345,
                height: 177,
                justifyContent: 'center',
                alignContent: 'center',
                alignSelf: 'center',
                margin: { top: 20 },
                positionType: 'absolute',
              }}
              uiBackground={{
                texture: { src: this.src + '/images/frame.png' },
                textureMode: 'nine-slices',
              }}
            >
              <UiEntity
                key={'ui-not-active-text'}
                uiTransform={{
                  display: 'flex',
                  width: '95%',
                  height: '100%',
                  alignSelf: 'center',
                  positionType: 'absolute',
                }}
                uiText={{
                  value: this.notStartedDescText,
                  fontSize: 18,
                  textAlign: 'middle-center',
                }}
              />
            </UiEntity>
            <UiEntity
              key={'ui-ok-button-not-active'}
              uiTransform={{
                display: 'flex',
                width: 230,
                height: 74,
                flexDirection: 'column',
                justifyContent: 'center',
                alignContent: 'center',
                alignSelf: 'center',
                positionType: 'absolute',
                position: { bottom: 0 },
              }}
              uiBackground={{
                texture: { src: this.src + '/images/ok_button.png' },
                textureMode: 'stretch',
              }}
            >
              <UiEntity
                key={'ui-ok-button-not-active-text'}
                uiTransform={{
                  display: 'flex',
                  width: '100%',
                  height: 55,
                  positionType: 'absolute',
                  position: { top: 5, left: 10 },
                }}
                uiText={{
                  value: '<b>OK</b>',
                  textAlign: 'middle-center',
                  fontSize: 28,
                }}
                onMouseDown={() => this.hideDispenserUi()}
              />
            </UiEntity>
          </UiEntity>

          <UiEntity
            key={'ui-waiting'}
            uiTransform={{
              display: this.activeUi === UiType.WAITING ? 'flex' : 'none',
              width: 512 * 0.8,
              height: 408 * 0.8,
              justifyContent: 'center',
            }}
          >
            <UiEntity
              key={'ui-waiting-loader'}
              uiTransform={{
                display: 'flex',
                width: 128,
                height: 128,
                positionType: 'absolute',
                position: { top: 145 },
              }}
              uiBackground={{
                texture: { src: this.src + '/images/loader_static_with_margin.png' },
                textureMode: 'stretch',
                uvs: rotateUVs(SpinnerComponent.get(this.waitingSpinner).angle),
              }}
            />
            <UiEntity
              key={'ui-waiting-text'}
              uiTransform={{
                display: 'flex',
                width: '100%',
                height: 200,
                positionType: 'absolute',
              }}
              uiText={{
                value: '<b>Preparing your reward.</b>\nPlease wait and do not leave the scene.',
                fontSize: 24,
              }}
            />
          </UiEntity>

          <UiEntity
            key={'ui-already-claimed'}
            uiTransform={{
              display: this.activeUi === UiType.ALREADY_CLAIM ? 'flex' : 'none',
              width: 512 * 1,
              height: 512 * 0.8,
              justifyContent: 'center',
              alignContent: 'center',
              margin: { top: 20 },
              positionType: 'absolute',
            }}
          >
            <UiEntity
              key={'ui-already-claimed-text-one'}
              uiTransform={{
                display: 'flex',
                width: '100%',
                height: 40,
                positionType: 'absolute',
                position: { top: 40 },
              }}
              uiText={{
                value: '<b>Check your backpack!</b>',
                fontSize: 34,
              }}
            />
            <UiEntity
              key={'ui-frame-image'}
              uiTransform={{
                display: 'flex',
                width: 345,
                height: 177,
                justifyContent: 'center',
                alignContent: 'center',
                alignSelf: 'center',
                margin: { top: 20 },
                positionType: 'absolute',
              }}
              uiBackground={{
                texture: { src: this.src + '/images/frame.png' },
                textureMode: 'nine-slices',
              }}
            >
              <UiEntity
                key={'ui-already-claimed-icon'}
                uiTransform={{
                  display: 'flex',
                  width: 48,
                  height: 59,
                  positionType: 'absolute',
                  position: { top: 24 },
                }}
                uiBackground={{
                  texture: { src: this.src + '/images/backpack_icon.png' },
                  textureMode: 'stretch',
                }}
              />
              <UiEntity
                key={'ui-already-claimed-text-two'}
                uiTransform={{
                  display: 'flex',
                  width: '100%',
                  height: 20,
                  positionType: 'absolute',
                  position: { bottom: 40 },
                }}
                uiText={{
                  value: '<b>You already claimed this \nReward!</b>',
                  fontSize: 20,
                }}
              />
            </UiEntity>
            <UiEntity
              key={'ui-check-status'}
              uiTransform={{
                display: 'flex',
                width: 230,
                height: 74,
                flexDirection: 'column',
                justifyContent: 'center',
                alignContent: 'center',
                alignSelf: 'center',
                positionType: 'absolute',
                position: { bottom: 0 },
              }}
              uiBackground={{
                texture: { src: this.src + '/images/ok_button_empty.png' },
                textureMode: 'stretch',
              }}
            >
              <UiEntity
                key={'ui-check-status-text'}
                uiTransform={{
                  display: 'flex',
                  width: '100%',
                  height: 55,
                  positionType: 'absolute',
                  position: { top: 5 },
                }}
                uiBackground={{ color: Color4.create(0, 1, 0, 0) }}
                uiText={{
                  value: '<b>CHECK STATUS</b>',
                  fontSize: 16,
                }}
                onMouseDown={() => openExternalUrl({ url: 'https://decentraland.org/rewards' })}
              />
            </UiEntity>
          </UiEntity>

          <UiEntity
            key={'ui-captcha'}
            uiTransform={{
              display: this.activeUi === UiType.CAPTCHA ? 'flex' : 'none',
              width: 640 * 0.8 * 0.8,
              height: 510 * 0.8 * 0.89,
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignContent: 'center',
              margin: { top: 20 },
              positionType: 'absolute',
            }}
          >
            <UiEntity
              key={'ui-captcha-text-one'}
              uiTransform={{
                display: 'flex',
                width: '100%',
                height: 40,
                positionType: 'absolute',
                position: { top: 0 },
              }}
              uiText={{
                value: '<b>Solve the captcha</b>',
                fontSize: 35,
              }}
            />
            <UiEntity
              key={'ui-captcha-text-two'}
              uiTransform={{
                display: 'flex',
                width: '100%',
                height: 20,
                positionType: 'absolute',
                position: { top: 40 },
              }}
              uiText={{
                value: 'Type the main characters shown in the image.',
                fontSize: 16,
              }}
            />

            <UiEntity
              key={'ui-captcha-image-bg'}
              uiTransform={{
                display: this.captchaImage ? 'flex' : 'none',
                width: 300 * 1.3,
                height: 100 * 1.3,
                flexDirection: 'column',
                justifyContent: 'center',
                alignContent: 'center',
                alignSelf: 'center',
                positionType: 'absolute',
                position: { top: 70 },
                borderRadius: 10,
              }}
              uiBackground={{ color: Color4.White() }}
            />
            <UiEntity
              key={'ui-captcha-image'}
              uiTransform={{
                display: this.captchaImage ? 'flex' : 'none',
                width: 300 * 1.3,
                height: 100 * 1.3,
                flexDirection: 'column',
                justifyContent: 'center',
                alignContent: 'center',
                alignSelf: 'center',
                positionType: 'absolute',
                position: { top: 70 },
              }}
              uiBackground={{
                texture: { src: this.captchaImage ?? '' },
                textureMode: 'stretch',
              }}
            />

            <Input
              value={this.captchaText}
              onChange={v => (this.captchaText = v)}
              placeholder=""
              fontSize={30}
              uiTransform={{
                width: 170,
                height: 60,
                flexDirection: 'column',
                justifyContent: 'center',
                alignContent: 'center',
                alignSelf: 'center',
                positionType: 'absolute',
                position: { bottom: 60 },
              }}
            />

            <UiEntity
              key={'ui-ok-button-captcha'}
              uiTransform={{
                display: 'flex',
                width: 230,
                height: 74,
                flexDirection: 'column',
                justifyContent: 'center',
                alignContent: 'center',
                alignSelf: 'center',
                positionType: 'absolute',
                position: { bottom: -40 },
              }}
              uiBackground={{
                texture: { src: this.src + '/images/ok_button_empty.png' },
                textureMode: 'stretch',
              }}
            >
              <UiEntity
                key={'ui-ok-button-captcha-text'}
                uiTransform={{
                  display: 'flex',
                  width: '100%',
                  height: 55,
                  positionType: 'absolute',
                  position: { top: 5, left: 10 },
                }}
                uiText={{
                  value: '<b>OK</b>',
                  textAlign: 'middle-center',
                  fontSize: 28,
                }}
                onMouseDown={() => this.submitCaptcha()}
              />
            </UiEntity>
          </UiEntity>

          <UiEntity
            key={'ui-success'}
            uiTransform={{
              display: this.activeUi === UiType.SUCCESS ? 'flex' : 'none',
              width: 640 * 0.8 * 0.8,
              height: 510 * 0.8 * 0.89,
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignContent: 'center',
              margin: { top: 20 },
              positionType: 'absolute',
            }}
          >
            <UiEntity
              key={'ui-success-text-one'}
              uiTransform={{
                display: 'flex',
                width: '100%',
                height: 40,
                positionType: 'absolute',
                position: { top: 0 },
              }}
              uiText={{
                value: '<b>Reward Incoming!</b>',
                fontSize: 35,
              }}
            />
            <UiEntity
              key={'ui-success-text-two'}
              uiTransform={{
                display: 'flex',
                width: '100%',
                height: 20,
                positionType: 'absolute',
                position: { top: 40 },
              }}
              uiText={{
                value: 'It will arrive in your backpack in a few minutes.',
                fontSize: 16,
              }}
            />
            <UiEntity
              key={'ui-wearable-image'}
              uiTransform={{
                display: this.thumbnail ? 'flex' : 'none',
                width: 512 * 0.5,
                height: 512 * 0.5,
                flexDirection: 'column',
                justifyContent: 'center',
                alignContent: 'center',
                alignSelf: 'center',
                positionType: 'absolute',
                position: { top: 70 },
              }}
              uiBackground={{
                texture: { src: this.thumbnail ?? '' },
                textureMode: 'stretch',
              }}
            />
            <UiEntity
              key={'ui-ok-button-success'}
              uiTransform={{
                display: 'flex',
                width: 230,
                height: 74,
                flexDirection: 'column',
                justifyContent: 'center',
                alignContent: 'center',
                alignSelf: 'center',
                positionType: 'absolute',
                position: { bottom: -40 },
              }}
              uiBackground={{
                texture: { src: this.src + '/images/ok_button.png' },
                textureMode: 'stretch',
              }}
            >
              <UiEntity
                key={'ui-ok-button-success-text'}
                uiTransform={{
                  display: 'flex',
                  width: '100%',
                  height: 55,
                  positionType: 'absolute',
                  position: { top: 5, left: 10 },
                }}
                uiText={{
                  value: '<b>OK</b>',
                  textAlign: 'middle-center',
                  fontSize: 28,
                }}
                onMouseDown={() => this.hideDispenserUi()}
              />
            </UiEntity>
          </UiEntity>

          <UiEntity
            key={'ui-close'}
            uiTransform={{
              display: 'flex',
              width: 32,
              height: 32,
              positionType: 'absolute',
              position: { right: 0, top: 0 },
              margin: { top: 12, right: 12 },
              // Ensure it stays clickable above any dialog content
              zIndex: 1000,
            }}
            uiBackground={{
              texture: { src: this.src + '/images/close_button.png' },
              textureMode: 'stretch',
            }}
            onMouseDown={() => this.hideDispenserUi()}
          />
        </UiEntity>
      </UiEntity>
    );
  }

  // UI actions
  private showDispenserUi() {
    Tween.deleteFrom(this.uiEntity);
    engine.removeSystem('hide-dispenser-ui-system');
    engine.removeSystem('show-dispenser-ui-system');

    // Ensure UI is shown while animating
    if (!this.uiVisible) this.uiVisible = true;

    Tween.createOrReplace(this.uiEntity, {
      mode: Tween.Mode.Scale({
        start: Transform.get(this.uiEntity).scale,
        end: Vector3.create(1, 1, 1),
      }),
      duration: 150,
      easingFunction: EasingFunction.EF_EASEINSINE,
    });

    engine.addSystem(
      () => {
        const done = tweenSystem.tweenCompleted(this.uiEntity);
        if (done) engine.removeSystem('show-dispenser-ui-system');
      },
      undefined,
      'show-dispenser-ui-system',
    );
  }

  /**
   * @action Hide the dispenser UI
   */
  public hideDispenserUi() {
    Tween.deleteFrom(this.uiEntity);
    engine.removeSystem('hide-dispenser-ui-system');
    engine.removeSystem('show-dispenser-ui-system');
    this.removeButtonSystem();

    if (this.uiVisible) {
      Tween.createOrReplace(this.uiEntity, {
        mode: Tween.Mode.Scale({
          start: Transform.get(this.uiEntity).scale,
          end: Vector3.create(0, 0, 0),
        }),
        duration: 150,
        easingFunction: EasingFunction.EF_EASEINSINE,
      });

      engine.addSystem(
        () => {
          const done = tweenSystem.tweenCompleted(this.uiEntity);
          if (done) {
            this.uiVisible = false;
            this.activeUi = UiType.NONE;
            this.captchaId = null;
            this.captchaImage = null;
            this.captchaText = '';
            this.errorDetails = null;
            this.showErrorDetails = false;
            this.errorTitleText = null;
            this.errorBodyText = null;
            engine.removeSystem('hide-dispenser-ui-system');
          }
        },
        undefined,
        'hide-dispenser-ui-system',
      );
    }
  }

  private addButtonSystem() {
    if (this.buttonSystemAdded) return;
    this.buttonSystemAdded = true;
    engine.addSystem(
      () => {
        if (
          this.activeUi !== UiType.SUCCESS &&
          this.activeUi !== UiType.CAMPAIGN_NOT_STARTED &&
          this.activeUi !== UiType.CAMPAIGN_ENDED
        )
          return;
        if (inputSystem.isTriggered(InputAction.IA_PRIMARY, PointerEventType.PET_DOWN)) {
          this.hideDispenserUi();
          this.removeButtonSystem();
        }
      },
      undefined,
      'ui-keyboard-input-system',
    );
  }

  private removeButtonSystem() {
    if (!this.buttonSystemAdded) return;
    this.buttonSystemAdded = false;
    engine.removeSystem('ui-keyboard-input-system');
  }

  private alreadyClaimedUi() {
    this.activeUi = UiType.ALREADY_CLAIM;
    if (!this.uiVisible) this.uiVisible = true;
    this.showDispenserUi();
  }

  private errorUi(text: string, overrideAllText = false) {
    // If Rewards server complains about local preview catalyst not being found, show the dedicated hint.
    if (containsLocalCatalystNotFound(text)) {
      text = this.localPreviewRewardsHint();
      overrideAllText = true;
    }
    const pretty = prettifyErrorForUi(text, { overrideAllText });
    this.errorText = pretty.display;
    this.errorDetails = pretty.details;
    this.showErrorDetails = false;
    this.errorTitleText = null;
    this.errorBodyText = null;
    this.activeUi = UiType.ERROR;
    if (!this.uiVisible) this.uiVisible = true;
    this.showDispenserUi();
  }

  private notStartedUi(start: Date) {
    this.notStartedTitleText = "<b>You're a bit early!</b>";
    this.notStartedDescText =
      '<b>Claim this reward ' +
      '<color=#FE9F5A>' +
      start.toLocaleString('en-US', { month: 'long', day: 'numeric' }) +
      (start.getDate() == 1
        ? 'st'
        : start.getDate() == 2
          ? 'nd'
          : start.getDate() == 3
            ? 'rd'
            : 'th') +
      '</color> \nstarting at ' +
      '<color=#FE9F5A>' +
      start.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit' }) +
      '</color></b>';
    this.activeUi = UiType.CAMPAIGN_NOT_STARTED;
    if (!this.uiVisible) this.uiVisible = true;
    this.showDispenserUi();
    this.addButtonSystem();
  }

  private endedUi(end: Date) {
    this.notStartedTitleText = '﻿<b>You just missed it!</b>';
    this.notStartedDescText =
      '<b>This campaign ended on \n' +
      '<color=#FE9F5A>' +
      end.toLocaleString('en-US', { month: 'long', day: 'numeric' }) +
      (end.getDate() == 1 ? 'st' : end.getDate() == 2 ? 'nd' : end.getDate() == 3 ? 'rd' : 'th') +
      ' ' +
      end.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit' }) +
      '</color>' +
      "\n\nYou can check the marketplace to see if it's available for sale.</b>";
    this.activeUi = UiType.CAMPAIGN_ENDED;
    if (!this.uiVisible) this.uiVisible = true;
    this.showDispenserUi();
    this.addButtonSystem();
  }

  private genericFinishedUi() {
    this.notStartedTitleText = '<b>Campaign ended!</b>';
    this.notStartedDescText =
      "<b>This reward dispenser is closed at this moment.\n\nYou can check the marketplace to see if it's available for sale.</b>";
    this.activeUi = UiType.CAMPAIGN_ENDED;
    if (!this.uiVisible) this.uiVisible = true;
    this.showDispenserUi();
    this.addButtonSystem();
  }

  private outOfStockUi() {
    this.notStartedTitleText = '<b>You just missed it!</b>';
    this.notStartedDescText =
      "<b>Sorry, we are out of stock for this reward.\n\nYou can check the marketplace to see if it's available for sale.</b>";
    this.activeUi = UiType.CAMPAIGN_ENDED;
    if (!this.uiVisible) this.uiVisible = true;
    this.showDispenserUi();
    this.addButtonSystem();
  }

  private waitingUi() {
    this.activeUi = UiType.WAITING;
    if (!this.uiVisible) this.uiVisible = true;
    this.showDispenserUi();
  }

  private successUi(thumbnail: string) {
    this.thumbnail = thumbnail;
    this.activeUi = UiType.SUCCESS;
    if (!this.uiVisible) this.uiVisible = true;
    this.showDispenserUi();
    this.addButtonSystem();
    if (this.ActivateOnSuccess) {
      this.ActivateOnSuccess();
    }
  }

  private captchaUi(captchaId: string, captchaImage: string) {
    this.captchaId = captchaId;
    this.captchaImage = captchaImage;
    this.captchaText = '';
    this.activeUi = UiType.CAPTCHA;
    if (!this.uiVisible) this.uiVisible = true;
    this.showDispenserUi();
  }

  private async submitCaptcha() {
    if (!this.captchaId) {
      this.errorUi('Captcha session expired. Please try again.');
      return;
    }
    const value = (this.captchaText ?? '').trim();
    if (!value) {
      this.errorUi('Please complete the captcha.');
      return;
    }

    this.waitingUi();
    await this.requestToken(this.captchaId, value);
  }

  // Helpers
  private async setUserData() {
    this.userData = await getUserData({});
    if (!this.userData || !this.userData.data || !this.userData.data.publicKey) {
      this.errorUi('You must be connected with an Ethereum wallet to claim rewards.');
      return false;
    }
    return true;
  }

  private async requestToken(captcha_id?: string, captcha_value?: string) {
    const url = REWARDS_TESTING_ENABLED
      ? `${REWARDS_SERVER}/api/campaigns/${this.campaignId}/rewards`
      : `${REWARDS_SERVER}/api/rewards?campaign_id=${this.campaignId}`;

    const realm = await getRealm({});
    const realmInfo = realm.realmInfo as (PBRealmInfo & { domain: string }) | undefined;

    let catalyst = realmInfo ? (realmInfo.baseUrl ?? realmInfo.domain) : '';
    // If we only have a hostname, assume https
    if (catalyst && !catalyst.startsWith('http://') && !catalyst.startsWith('https://')) {
      catalyst = `https://${catalyst}`;
    }

    const isLocalPreviewCatalyst = catalyst.includes('127.0.0.1') || catalyst.includes('localhost');
    this.lastRequestWasLocalPreview = isLocalPreviewCatalyst;

    const beneficiary = this.userData.data.hasConnectedWeb3
      ? String(this.userData.data.userId ?? '').toLowerCase()
      : '';

    const body = JSON.stringify({
      campaign_key: this.dispenserKey,
      catalyst,
      beneficiary,
      ...(captcha_id && captcha_value ? { captcha_id, captcha_value } : {}),
    });

    try {
      const response: any = await signedFetch({
        url,
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        },
      });
      await this.processResponse(response);
    } catch (error: any) {
      if (this.activeUi !== UiType.ERROR) {
        const msg = String(error?.message ?? error);
        // Only show the Local Preview hint when we got an opaque failure (common with strict campaign flags)
        if (this.lastRequestWasLocalPreview && msg.includes('400')) {
          this.errorUi(this.localPreviewRewardsHint(), true);
        } else {
          this.errorUi('Error fetching reward server. ' + msg);
        }
      }
    }
  }

  private localPreviewRewardsHint() {
    return (
      'Rewards server rejected the request (400)\n\n' +
      'If the campaign has "Connected to Decentraland" and/or "Position inside Decentraland" flags, it wont be claimable from Local Preview.\n\n' +
      'Adjust the campaign flags to try testing after publishing.'
    );
  }

  private async getCaptcha() {
    try {
      const captchaResponse = await fetch(`${REWARDS_SERVER}/api/captcha`, { method: 'POST' });
      const captchaBody: any = await captchaResponse.json();
      const id = captchaBody?.data?.id;
      const image = captchaBody?.data?.image;
      if (!id || !image) {
        this.errorUi('Captcha could not be loaded. Please try again.');
        return;
      }
      this.captchaUi(id, image);
    } catch (e: any) {
      this.errorUi('Captcha could not be loaded. ' + (e?.message ?? String(e)));
    }
  }

  private async processResponse(response: any) {
    if (!response || !response.body) {
      if (this.lastRequestWasLocalPreview) {
        this.errorUi(this.localPreviewRewardsHint(), true);
      } else {
        this.errorUi('Error fetching reward server.\nInvalid response.', true);
      }
      return;
    }

    const bodyStr = response.body as string;

    // Captcha required (recommended dispenser flag "Captcha Protection")
    if (bodyStr?.toLowerCase?.().includes('captcha')) {
      await this.getCaptcha();
      return;
    }

    try {
      const json = JSON.parse(response.body);
      if (json.ok === false) {
        if (
          (json.code && String(json.code).toLowerCase().includes('captcha')) ||
          (json.error && String(json.error).toLowerCase().includes('captcha'))
        ) {
          await this.getCaptcha();
          return;
        }
        const codeLower = String(json.code ?? '').toLowerCase();

        // Explicit out-of-stock codes (if provided)
        if (codeLower.includes('out') && codeLower.includes('stock')) {
          this.outOfStockUi();
          return;
        }

        // Explicit already-claimed codes (if provided)
        if (codeLower.includes('already') && codeLower.includes('claim')) {
          this.alreadyClaimedUi();
          return;
        }

        // Campaign not active (use explicit json.code; map to early/late using provided dates)
        if (isInactiveCampaignCode(json.code)) {
          if (this.startDateParsed && this.isCampaignEarly()) {
            this.notStartedUi(this.startDateParsed);
            return;
          }
          if (this.endDateParsed && this.isCampaignLate()) {
            this.endedUi(this.endDateParsed);
            return;
          }
          this.genericFinishedUi();
          return;
        }
        this.errorUi(json.error ? json.error : json.code ? json.code : 'Invalid response');
        return;
      } else if (json && json.ok && json.data && !json.data[0] && !json.error) {
        this.outOfStockUi();
        return;
      } else if (json && json.ok && json.data && json.data[0] && !json.error) {
        this.alreadyClaimedKeys.push(this.dispenserKey);
        this.successUi(json.data[0].image);
        return;
      }
    } catch (_e) {
      this.errorUi(response.body);
      return;
    }
  }

  private isCampaignEarly() {
    if (!this.startDateParsed) return false;
    return new Date() < this.startDateParsed;
  }

  private isCampaignLate() {
    if (!this.endDateParsed) return false;
    return new Date() > this.endDateParsed;
  }
}

//// Parse dates

type ParsedDateParts = { year: number; month: number; day: number };

// NOTE: startDate/endDate arrive as strings from the Creator Hub (composite params).
// We parse common human formats deterministically instead of relying on `new Date(str)`,
// which is inconsistent across runtimes/locales.
function rotateUVs(angle: number): number[] {
  const uv00 = rotate2D(angle, 0, 0, 0.5, 0.5);
  const uv01 = rotate2D(angle, 0, 1, 0.5, 0.5);
  const uv11 = rotate2D(angle, 1, 1, 0.5, 0.5);
  const uv10 = rotate2D(angle, 1, 0, 0.5, 0.5);
  return [uv00[0], uv00[1], uv01[0], uv01[1], uv11[0], uv11[1], uv10[0], uv10[1]];
}

function rotate2D(
  angle: number,
  x: number,
  y: number,
  centerX: number,
  centerY: number,
): [number, number] {
  const a = (angle % 360) * (Math.PI / 180);
  const cosA = Math.cos(a);
  const sinA = Math.sin(a);
  const X = x - centerX;
  const Y = y - centerY;
  const NX = X * cosA - Y * sinA;
  const NY = Y * cosA + X * sinA;
  return [NX + centerX, NY + centerY];
}

function parseCampaignDateParts(input: string): ParsedDateParts | null {
  const s = input.trim();
  if (!s) return null;

  // Day-first formats (your requested set), supports 1-2 digit day/month:
  // dd-mm-yyyy, dd-mm-yy, dd.mm.yy, dd.mm.yyyy, dd/mm/yy, dd/mm/yyyy
  // Plus ISO-style (recommended) yyyy-mm-dd (also with '.' or '/')
  //
  // We intentionally do NOT support ambiguous US-style mm/dd/yyyy.
  const dayFirst = /^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2}|\d{4})$/;
  const isoLike = /^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/;

  let day: number;
  let month: number;
  let year: number;

  const isoMatch = s.match(isoLike);
  if (isoMatch) {
    year = Number(isoMatch[1]);
    month = Number(isoMatch[2]);
    day = Number(isoMatch[3]);
  } else {
    const m = s.match(dayFirst);
    if (!m) return null;
    day = Number(m[1]);
    month = Number(m[2]);
    const yRaw = Number(m[3]);
    year = yRaw < 100 ? (yRaw >= 70 ? 1900 + yRaw : 2000 + yRaw) : yRaw;
  }

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  // Validate using Date normalization guard (catches 31/02 etc).
  const probe = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (probe.getFullYear() !== year || probe.getMonth() !== month - 1 || probe.getDate() !== day)
    return null;

  return { year, month, day };
}

function parseCampaignStartDate(input?: string | Date): Date | undefined {
  if (!input) return undefined;
  if (input instanceof Date) return Number.isFinite(input.getTime()) ? input : undefined;

  const parts = parseCampaignDateParts(input);
  if (!parts) return undefined;
  return new Date(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0);
}

function parseCampaignEndDate(input?: string | Date): Date | undefined {
  if (!input) return undefined;
  if (input instanceof Date) return Number.isFinite(input.getTime()) ? input : undefined;

  const parts = parseCampaignDateParts(input);
  if (!parts) return undefined;
  // Interpret end date as end-of-day for date-only inputs (more intuitive in Creator Hub).
  return new Date(parts.year, parts.month - 1, parts.day, 23, 59, 59, 999);
}

type PrettyError = { display: string; details: string | null };

function truncateLongMessageForDetails(text: string, maxLines: number = 3): PrettyError {
  const full = normalizeTextForUi(text);
  const preview = clampTextLines(full, { maxCharsPerLine: 46, maxLines });

  const truncated = preview.includes('…');
  const previewAscii = truncated ? preview.replace(/…/g, '...') : preview;

  return {
    display: previewAscii,
    details: truncated ? full : null,
  };
}

function prettifyErrorForUi(raw: string, opts?: { overrideAllText?: boolean }): PrettyError {
  const overrideAllText = opts?.overrideAllText ?? false;
  const input = String(raw ?? '');

  if (overrideAllText) {
    return truncateLongMessageForDetails(input, 3);
  }

  // Strip huge SignedFetch exception payloads (RequestEnvelope dumps, headers, etc)
  // Keep just the high-signal first part.
  let details: string | null = null;
  let core = input;
  const cutMarkers = ['RequestEnvelope:', 'WebRequestType:', 'CommonArguments:', 'Headers:'];
  for (const m of cutMarkers) {
    const idx = core.indexOf(m);
    if (idx !== -1) {
      details = input;
      core = core.slice(0, idx).trim();
      break;
    }
  }

  // Collapse noisy prefixes like "[ERROR] [time] [Error]"
  core = core.replace(/^\[[A-Z]+\][^\n]*?\]\s*/g, '').trim();

  // Human-friendly common cases (even if server error text is messy)
  const normalized = core.toLowerCase();
  if (normalized.includes('out of stock')) {
    return {
      display: '<b>Out of stock</b>\n\n<i>Sorry, this reward is no longer available.</i>',
      details: clampTextLines(core, { maxCharsPerLine: 56, maxLines: 18 }),
    };
  }
  if (
    normalized.includes('already') &&
    (normalized.includes('claim') || normalized.includes('claimed'))
  ) {
    return {
      display: '<b>Already claimed</b>\n\n<i>Looks like you already claimed this reward.</i>',
      details: clampTextLines(core, { maxCharsPerLine: 56, maxLines: 18 }),
    };
  }

  // If this looks like a low-level server/runtime error, hide it under “details”
  const looksLikeServerError =
    input.length > 140 ||
    /https?:\/\/rewards\.decentraland/i.test(input) ||
    /exception\s*\(code\s*\d+\)/i.test(input) ||
    /genericpostrequest|requestenvelope|x-identity|campaign_key|captcha_id|beneficiary/i.test(
      input,
    ) ||
    core.trim().startsWith('{') ||
    core.trim().startsWith('[');

  const coreClamped = clampTextLines(core, { maxCharsPerLine: 50, maxLines: 12 });

  if (looksLikeServerError) {
    return truncateLongMessageForDetails(details ?? input, 3);
  }

  // Otherwise treat it as a user-facing message.
  return {
    display: `<b>There is an error:</b>\n\n<i>${coreClamped.replace('_', ' ')}</i>`,
    details: null,
  };
}

function isInactiveCampaignCode(code: unknown): boolean {
  const s = String(code ?? '').toLowerCase();
  if (!s) return false;
  // Explicit codes seen in Rewards API responses
  if (s === 'campaign_key_uninitiated') return true;
  if (s === 'campaign_disabled') return true;
  // Some deployments use "finished" variants
  if (s.includes('uninitiated')) return true;
  if (s.includes('disabled')) return true;
  if (s.includes('finished')) return true;
  return false;
}

function clampTextLines(text: string, opts: { maxCharsPerLine: number; maxLines: number }): string {
  const maxCharsPerLine = Math.max(10, opts.maxCharsPerLine);
  const maxLines = Math.max(2, opts.maxLines);

  const normalized = String(text ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .trim();

  // Preserve explicit newlines but wrap each paragraph by words.
  const paragraphs = normalized
    .split('\n')
    .map(p => p.trim())
    .filter(p => p.length > 0);
  const lines: string[] = [];

  for (const p of paragraphs) {
    const words = p.split(/\s+/).filter(Boolean);
    let line = '';
    for (const w of words) {
      // If a single token is too long (e.g. URL), hard-break it so it can't overflow the UI.
      if (w.length > maxCharsPerLine) {
        if (line) {
          lines.push(line);
          line = '';
          if (lines.length >= maxLines) break;
        }
        let rest = w;
        while (rest.length > maxCharsPerLine) {
          lines.push(rest.slice(0, maxCharsPerLine));
          rest = rest.slice(maxCharsPerLine);
          if (lines.length >= maxLines) break;
        }
        if (lines.length >= maxLines) break;
        line = rest;
      } else {
        const next = line ? `${line} ${w}` : w;
        if (next.length <= maxCharsPerLine) {
          line = next;
        } else {
          if (line) lines.push(line);
          line = w;
        }
      }
      if (lines.length >= maxLines) break;
    }
    if (lines.length >= maxLines) break;
    if (line) lines.push(line);
    if (lines.length >= maxLines) break;
  }

  if (lines.length === 0) return 'Unknown error.';

  // If we likely truncated, add ellipsis on last line.
  const joined = lines.slice(0, maxLines).join('\n');
  const truncated = joined.length < normalized.length;
  if (truncated) {
    const last = lines[Math.min(lines.length, maxLines) - 1];
    const base =
      last.length > maxCharsPerLine - 1 ? last.slice(0, maxCharsPerLine - 1).trimEnd() : last;
    lines[Math.min(lines.length, maxLines) - 1] = base.replace(/\.*$/, '') + '…';
    return lines.slice(0, maxLines).join('\n');
  }

  return joined;
}

function splitTitleAndBodyForUi(text: string): { title: string; body: string | null } {
  const normalized = normalizeTextForUi(text);
  const paragraphs = normalized
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean);
  const title = paragraphs[0] ?? 'Error';
  const body = paragraphs.length > 1 ? paragraphs.slice(1).join('\n\n') : null;
  return { title, body };
}

function normalizeTextForUi(text: string): string {
  const s = String(text ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .trim();

  // Trim each line, keep paragraph breaks (double newlines)
  const lines = s.split('\n').map(l => l.trimEnd());
  const compact = lines.join('\n').replace(/\n{3,}/g, '\n\n');

  // Hard-break overlong tokens to prevent overflow on URLs/long keys
  return hardBreakLongTokens(compact, 46);
}

function hardBreakLongTokens(text: string, maxTokenLen: number): string {
  const maxLen = Math.max(12, maxTokenLen);
  const parts = text.split(/(\s+)/); // keep whitespace separators
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (!p || /^\s+$/.test(p)) continue;
    if (p.length <= maxLen) continue;
    let out = '';
    for (let j = 0; j < p.length; j += maxLen)
      out += p.slice(j, j + maxLen) + (j + maxLen < p.length ? '\n' : '');
    parts[i] = out;
  }
  return parts.join('');
}

function containsLocalCatalystNotFound(input: string): boolean {
  const s = String(input ?? '');
  if (!/catalyst/i.test(s) || !/not found/i.test(s)) return false;

  // Common pattern: Catalyst "http://127.0.0.1:8000" not found.
  const m = s.match(/catalyst\s+"([^"]+)".{0,80}?not found/i);
  if (!m) return false;

  const urlStr = m[1];
  const host = extractHostname(urlStr).toLowerCase();
  return isLocalHostname(host);
}

function isLocalHostname(host: string): boolean {
  if (!host) return false;
  if (host === 'localhost') return true;
  if (host === '0.0.0.0') return true;
  if (host.startsWith('127.')) return true;

  // Private IPv4 ranges: 10/8, 192.168/16, 172.16/12
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;

  const a = Number(ipv4[1]);
  const b = Number(ipv4[2]);
  const c = Number(ipv4[3]);
  const d = Number(ipv4[4]);
  if ([a, b, c, d].some(n => !Number.isFinite(n) || n < 0 || n > 255)) return false;

  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;

  return false;
}

function extractHostname(urlLike: string): string {
  let s = String(urlLike ?? '').trim();
  // Remove protocol if present (http://, https://, ws://, etc)
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  // Remove leading slashes if present
  s = s.replace(/^\/\//, '');
  // Drop path/query/fragment
  s = s.split('/')[0];
  // Drop credentials (user:pass@host)
  const at = s.lastIndexOf('@');
  if (at !== -1) s = s.slice(at + 1);
  // Drop port
  s = s.split(':')[0];
  return s;
}
