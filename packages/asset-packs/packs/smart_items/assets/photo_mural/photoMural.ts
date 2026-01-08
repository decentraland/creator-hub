import type { Entity } from '@dcl/sdk/ecs';
import {
  AudioSource,
  ColliderLayer,
  EasingFunction,
  engine,
  GltfContainer,
  InputAction,
  Material,
  MaterialTransparencyMode,
  MeshCollider,
  MeshRenderer,
  pointerEventsSystem,
  Transform,
  Tween,
  tweenSystem,
  VisibilityComponent,
} from '@dcl/sdk/ecs';
import { Quaternion, Vector3 } from '@dcl/sdk/math';

type Photo = {
  id: string;
  dateTime: number;
  isPublic: boolean;
  thumbnailUrl: string;
  url: string;
  entity?: Entity;
};

export class PhotoMural {
  // Logic properties
  maxPhotos: number = 10;
  sceneIds: string[] = [];
  photos: Photo[] = [];
  thumbWidth: number = 1;
  thumbHeight: number = this.thumbWidth * 0.5625;
  scrollIndex: number = 0;
  selectedPhotos: Photo[] = [];
  selectedPhotoId: string = '';

  // Entities
  carouselEntity: Entity;
  buttonSoundEntity: Entity;
  spinnerEntity: Entity;

  // Timer
  refreshRate: number = 10;
  refreshTimer: number = 0;

  // Cache
  photosBySceneId = new Map<string, Photo[]>();

  constructor(
    public src: string,
    public entity: Entity,
    public button_prev: Entity,
    public button_next: Entity,
    public coordinates: string,
  ) {
    this.carouselEntity = engine.addEntity();

    // Create button sound entity
    this.buttonSoundEntity = engine.addEntity();
    Transform.create(this.buttonSoundEntity, { parent: this.entity });
    AudioSource.create(this.buttonSoundEntity, {
      audioClipUrl: '{assetPath}/button-sound.mp3',
      playing: false,
      loop: false,
      volume: 1.0,
    });
  }

  /**
   * Start function - called when the script is initialized
   */
  async start() {
    console.log('PhotoMural initialized for entity:', this.entity);

    // Setup Spinner first - show immediately since we're loading
    this.setupSpinner();

    // Setup Frame and Billboard (Visuals)
    // Assuming 'src' might be the GLTF for the billboard/frame
    // Remote code created a frameEntity and a billboard.
    // We will attach them to this.entity.

    const frameEntity = engine.addEntity();
    Transform.create(frameEntity, {
      parent: this.entity,
      position: Vector3.create(0, 1.9, -0.29),
      rotation: Quaternion.fromEulerDegrees(0, 180, 0),
      scale: Vector3.create(4, 4, 1),
    });
    MeshCollider.setPlane(frameEntity, ColliderLayer.CL_PHYSICS);

    const billboard = engine.addEntity();
    Transform.create(billboard, {
      parent: this.entity,
      position: Vector3.create(0, -0.7, 0.1),
      scale: Vector3.create(1, 1, 1),
    });

    if (this.src && this.src.length > 0) {
      GltfContainer.create(billboard, {
        src: this.src,
        visibleMeshesCollisionMask: ColliderLayer.CL_POINTER,
        invisibleMeshesCollisionMask: ColliderLayer.CL_PHYSICS,
      });
    } else {
      // Fallback if no src provided, maybe use the one from remote example or just skip
      GltfContainer.create(billboard, {
        src: '{assetPath}/billboard.glb', // Default from remote example
        visibleMeshesCollisionMask: ColliderLayer.CL_POINTER,
        invisibleMeshesCollisionMask: ColliderLayer.CL_PHYSICS,
      });
    }

    // Setup Carousel
    Transform.create(this.carouselEntity, {
      parent: this.entity,
      position: Vector3.create(-1.025, this.thumbHeight / 2 + 0.45, -0.35),
    });

    // Setup Buttons
    this.setupButton(this.button_prev, -1);
    this.setupButton(this.button_next, 1);

    // Initialize scene IDs from coordinates and then fetch photos
    await this.initPhotoMuralSystem([this.coordinates]);

    // Initial fetch - spinner is already visible
    this.getCameraReelPhotos();
  }

  /**
   * Update function - called every frame
   * @param dt - Delta time since last frame (in seconds)
   */
  update(dt: number) {
    this.refreshTimer += dt;
    if (this.refreshTimer < this.refreshRate) return;
    this.refreshTimer = 0;

    // Show spinner when refreshing
    this.showSpinner();
    this.getCameraReelPhotos();
  }

  private setupButton(buttonEntity: Entity, movement: number) {
    pointerEventsSystem.onPointerDown(
      {
        entity: buttonEntity,
        opts: {
          button: InputAction.IA_POINTER,
          hoverText: movement === -1 ? 'Previous' : 'Next',
        },
      },
      () => {
        // Play button sound
        const audio = AudioSource.getMutable(this.buttonSoundEntity);
        audio.currentTime = 0;
        audio.playing = true;

        this.scrollCarousel(movement);
      },
    );
  }

  private setupSpinner() {
    this.spinnerEntity = engine.addEntity();
    Transform.create(this.spinnerEntity, {
      parent: this.entity,
      position: Vector3.create(0, 2.05, -0.35),
      scale: Vector3.create(1, 1, 1),
    });

    MeshRenderer.setPlane(this.spinnerEntity);
    Material.setPbrMaterial(this.spinnerEntity, {
      texture: Material.Texture.Common({
        src: '{assetPath}/spinner.png',
      }),
      transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND,
      castShadows: false,
      metallic: 0,
      roughness: 1,
    });

    // Start continuous rotation
    Tween.setRotateContinuous(this.spinnerEntity, Quaternion.fromEulerDegrees(90, 0, 0), 100);

    // Show spinner immediately - we're loading from the start
    VisibilityComponent.createOrReplace(this.spinnerEntity, {
      visible: true,
    });
  }

  private showSpinner() {
    VisibilityComponent.getMutable(this.spinnerEntity).visible = true;
  }

  private hideSpinner() {
    VisibilityComponent.getMutable(this.spinnerEntity).visible = false;
  }

  private async initPhotoMuralSystem(sceneCoords: string[]) {
    for (const coord of sceneCoords) {
      try {
        const response = await fetch(
          'https://places.decentraland.org/api/places/?positions=' + coord,
        );
        const placeBody = await response.json();
        const sceneId = placeBody?.data[0]?.id;
        if (sceneId) this.sceneIds.push(sceneId);
      } catch (e) {
        console.error('Error fetching scene ID for coord', coord, e);
      }
    }
    // Deduplicate
    this.sceneIds = [...new Set(this.sceneIds)];
  }

  private async getCameraReelPhotos() {
    const getCameraReelURL = (placeId: string) =>
      `https://camera-reel-service.decentraland.org/api/places/${placeId}/images`;

    // Ensure spinner is visible when fetching starts
    this.showSpinner();

    for (const sceneId of this.sceneIds) {
      try {
        const response = await fetch(getCameraReelURL(sceneId));
        const photosBody = await response.json();
        this.photosBySceneId.set(sceneId, photosBody.images);
      } catch (e) {
        console.error('Error fetching photos for scene', sceneId, e);
      }
    }

    const allPhotos: Photo[] = [];
    this.sceneIds.forEach(sceneId => {
      const photos = this.photosBySceneId.get(sceneId);
      if (photos) {
        allPhotos.push(...photos.map((photo: any) => ({ ...photo })));
      }
    });

    this.processNewPhotos(allPhotos);
  }

  processNewPhotos(newPhotos: Photo[]) {
    const currentIds = this.photos.map(p => p.id);
    const tempNewPhotos = newPhotos
      .sort((p1, p2) => p2.dateTime - p1.dateTime)
      .slice(0, this.maxPhotos);

    const photosToRemove = this.photos.filter(p => !tempNewPhotos.some(newP => newP.id === p.id));
    photosToRemove.forEach(photo => this.removePhoto(photo));

    tempNewPhotos.forEach(photo => {
      if (!currentIds.includes(photo.id)) {
        this.createPhoto(photo);
      }
    });

    this.placePhotos();

    if (!this.selectedPhotoId && this.photos.length > 0) {
      this.setSelectedPhoto(this.photos[0]);
    }

    // Hide spinner only when we actually have photos loaded
    if (this.photos.length > 0) {
      this.hideSpinner();
    }
  }

  private createPhoto(photo: Photo) {
    photo.entity = engine.addEntity();
    Transform.create(photo.entity, {
      parent: this.carouselEntity,
      position: Vector3.create(0, 0.3, 0),
      scale: Vector3.create(this.thumbWidth * 0.5, this.thumbHeight * 0.5, 1),
    });

    MeshRenderer.setPlane(photo.entity);
    Material.setBasicMaterial(photo.entity, {
      texture: Material.Texture.Common({
        src: photo.thumbnailUrl,
      }),
    });

    MeshCollider.setPlane(photo.entity, ColliderLayer.CL_POINTER);

    VisibilityComponent.createOrReplace(photo.entity, {
      visible: false,
    });

    this.photos.push(photo);

    pointerEventsSystem.onPointerDown(
      {
        entity: photo.entity!,
        opts: {
          button: InputAction.IA_ANY,
          maxDistance: 10,
          hoverText: 'View Photo',
        },
      },
      cmd => {
        if (cmd.button === InputAction.IA_POINTER) {
          this.setSelectedPhoto(photo);
        }
        if (cmd.button === InputAction.IA_PRIMARY) {
          this.scrollCarousel(-1);
        }
        if (cmd.button === InputAction.IA_SECONDARY) {
          this.scrollCarousel(1);
        }
      },
    );

    // Create selectedPhotoItem
    const selectedPhotoEntity = engine.addEntity();
    this.selectedPhotos.push({ ...photo, entity: selectedPhotoEntity });

    Transform.create(selectedPhotoEntity, {
      parent: this.entity,
      position: Vector3.create(0, 2.05, -0.35),
      scale: Vector3.create(0, 0, 0),
    });

    MeshRenderer.setPlane(selectedPhotoEntity);
    Material.setBasicMaterial(selectedPhotoEntity, {
      texture: Material.Texture.Common({
        src: photo?.url,
      }),
    });
  }

  private setSelectedPhoto(photo: Photo) {
    if (this.selectedPhotoId == photo.id) return;

    for (const selectedPhoto of this.selectedPhotos) {
      if (selectedPhoto.entity) {
        Tween.deleteFrom(selectedPhoto.entity);
        Transform.getMutable(selectedPhoto.entity).scale = Vector3.create(0, 0, 0);
      }
    }

    this.selectedPhotoId = photo.id;
    const newSelectedPhoto = this.selectedPhotos.find(p => p.id === photo.id);

    if (newSelectedPhoto && newSelectedPhoto.entity) {
      Tween.createOrReplace(newSelectedPhoto.entity, {
        mode: Tween.Mode.Scale({
          start: Vector3.create(1.5, 0.7, 1),
          end: Vector3.create(3.05, 3.05 * 0.5625, 1),
        }),
        duration: 300,
        easingFunction: EasingFunction.EF_EASEOUTQUAD,
      });
    }
  }

  private removePhoto(photo: Photo) {
    if (photo.entity) {
      engine.removeEntityWithChildren(photo.entity);
    }
    this.photos = this.photos.filter(p => p.id !== photo.id);

    if (this.selectedPhotoId === photo.id && this.photos.length > 0) {
      this.setSelectedPhoto(this.photos[0]);
    } else if (this.photos.length === 0) {
      this.selectedPhotoId = '';
    }

    const selectedPhoto = this.selectedPhotos.find(p => p.id === photo.id);
    if (selectedPhoto && selectedPhoto.entity) {
      engine.removeEntityWithChildren(selectedPhoto.entity);
    }
    this.selectedPhotos = this.selectedPhotos.filter(p => p.id !== photo.id);
  }

  private placePhotos() {
    this.photos = this.photos.sort((p1, p2) => p2.dateTime - p1.dateTime);

    this.photos.forEach((photo, i) => {
      if (photo.entity) {
        const targetPosition = Vector3.create(i * (this.thumbWidth + 0.025), 0, 0);
        Transform.getMutable(photo.entity).position = targetPosition;
      }
    });
    this.setPhotosVisibility();

    if (this.selectedPhotos.length > 0 && !this.selectedPhotoId) {
      this.setSelectedPhoto(this.photos[0]);
    }
  }

  scrollCarousel(positions: number) {
    if (this.scrollIndex + positions < 0 || this.scrollIndex + positions >= this.photos.length - 2)
      return;

    const currentPosition = Transform.get(this.carouselEntity).position;
    this.scrollIndex += positions;

    // before moving hide the last photo
    const oldPhoto =
      positions > 0 ? this.photos[this.scrollIndex - 1] : this.photos[this.scrollIndex + 3];
    if (oldPhoto) {
      this.hidePhoto(oldPhoto);
    }

    Tween.createOrReplace(this.carouselEntity, {
      mode: Tween.Mode.Move({
        start: currentPosition,
        end: Vector3.create(
          this.scrollIndex * -1 * (this.thumbWidth + 0.025) - this.thumbWidth,
          currentPosition.y,
          currentPosition.z,
        ),
      }),
      duration: 300,
      easingFunction: EasingFunction.EF_EASEOUTSINE,
    });

    // We need a system to check for tween completion
    const systemName = 'scrollSystem_' + Math.random().toString();
    engine.addSystem(
      () => {
        const tweenCompleted = tweenSystem.tweenCompleted(this.carouselEntity);
        if (tweenCompleted) {
          const newPhoto =
            positions < 0 ? this.photos[this.scrollIndex] : this.photos[this.scrollIndex + 2];
          if (newPhoto) {
            this.showPhoto(newPhoto);
          }
          engine.removeSystem(systemName);
        }
      },
      undefined,
      systemName,
    );
  }

  setPhotosVisibility() {
    this.photos.forEach((photo, i) => {
      const isVisible = i >= this.scrollIndex && i <= this.scrollIndex + 2;

      if (isVisible) {
        this.showPhoto(photo);
      } else {
        this.hidePhoto(photo);
      }
    });
  }

  hidePhoto(photo: Photo) {
    if (!photo.entity) return;
    VisibilityComponent.getMutable(photo.entity).visible = false;
    MeshCollider.getMutable(photo.entity).collisionMask = ColliderLayer.CL_NONE;
    Tween.deleteFrom(photo.entity);
  }

  showPhoto(photo: Photo) {
    if (!photo.entity) return;
    VisibilityComponent.getMutable(photo.entity).visible = true;
    MeshCollider.getMutable(photo.entity).collisionMask = ColliderLayer.CL_POINTER;
    Tween.createOrReplace(photo.entity, {
      mode: Tween.Mode.Scale({
        start: Vector3.create(this.thumbWidth * 0.5, this.thumbHeight * 0.5, 1),
        end: Vector3.create(this.thumbWidth, this.thumbHeight, 1),
      }),
      duration: 50,
      easingFunction: EasingFunction.EF_EASEOUTSINE,
    });
  }
}
