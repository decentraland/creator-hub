import { useCallback, useMemo, useState } from 'react';

import type { TextureIssue, TextureImageInfo } from '../texture-validation';
import { Error } from '../Error';
import { Button } from '../../Button';
import type { Asset } from '../types';
import { isModelAsset } from '../types';
import { determineAssetType, formatFileName } from '../utils';
import { AssetSlides } from './AssetSlides';
import { TextureWarnings } from './TextureWarnings';
import { useSliderAssets } from './useSliderAssets';
import type { PropTypes, Thumbnails } from './types';

import './Slider.css';

enum ImportStep {
  UPLOAD = 'upload',
  TEXTURE_WARNINGS = 'texture_warnings',
  CONFIRM = 'confirm',
}

export function Slider({ assets, onSubmit, isNameAvailable, isImporting = false }: PropTypes) {
  const { assets: uploadedAssets, setAssets: setUploadedAssets } = useSliderAssets(assets);
  const [slide, setSlide] = useState(0);
  const [screenshots, setScreenshots] = useState<Thumbnails>({});
  const [step, setStep] = useState<ImportStep>(ImportStep.UPLOAD);
  const [isFixingTextures, setIsFixingTextures] = useState(false);

  const invalidNames = useMemo(() => {
    const all = new Set<string>();
    const invalid = new Set<string>();

    for (const asset of uploadedAssets) {
      const name = formatFileName(asset);
      if (all.has(name) || !isNameAvailable(asset, name)) {
        invalid.add(name);
      } else {
        all.add(name);
      }
    }

    return invalid;
  }, [uploadedAssets, isNameAvailable]);

  const textureIssues = useMemo(() => {
    const issues: { asset: Asset; issues: TextureIssue[]; images: TextureImageInfo[] }[] = [];
    for (const asset of uploadedAssets) {
      if (isModelAsset(asset) && asset.textureIssues?.length) {
        issues.push({
          asset,
          issues: asset.textureIssues,
          images: asset.textureImages ?? [],
        });
      }
    }
    return issues;
  }, [uploadedAssets]);

  const hasTextureIssues = textureIssues.length > 0;

  const handleSubmit = useCallback(() => {
    onSubmit(
      uploadedAssets.map($ => ({
        ...$,
        thumbnail: screenshots[$.blob.name],
      })),
    );
  }, [uploadedAssets, screenshots, onSubmit]);

  const handleConfirmImport = useCallback(() => {
    if (hasTextureIssues) {
      setStep(ImportStep.TEXTURE_WARNINGS);
    } else if (invalidNames.size > 0) {
      setStep(ImportStep.CONFIRM);
    } else {
      handleSubmit();
    }
  }, [hasTextureIssues, invalidNames, handleSubmit]);

  const handleFixTextures = useCallback(async () => {
    setIsFixingTextures(true);
    try {
      const { fixExternalImages, fixGlbEmbeddedImages } = await import('../texture-validation');

      const updatedAssets = await Promise.all(
        uploadedAssets.map(async asset => {
          if (
            !isModelAsset(asset) ||
            !asset.textureIssues?.length ||
            !asset.textureImages?.length
          ) {
            return asset;
          }

          const isGlb = asset.extension.toLowerCase() === 'glb';

          if (isGlb) {
            const buffer = await asset.blob.arrayBuffer();
            const fixedBuffer = await fixGlbEmbeddedImages(
              buffer,
              asset.textureImages,
              asset.textureIssues,
            );
            const fixedBlob = new File([fixedBuffer], asset.blob.name, {
              type: asset.blob.type,
            });
            return {
              ...asset,
              blob: fixedBlob,
              textureIssues: undefined,
              textureImages: undefined,
            };
          } else {
            const externalFiles = new Map(asset.images.map(img => [img.blob.name, img]));

            const fixedFiles = await fixExternalImages(
              asset.textureImages,
              asset.textureIssues,
              externalFiles,
            );

            const updatedImages = asset.images.map(img => {
              const fixed = fixedFiles.get(img.blob.name);
              return fixed ? { ...img, blob: fixed } : img;
            });

            return {
              ...asset,
              images: updatedImages,
              textureIssues: undefined,
              textureImages: undefined,
            };
          }
        }),
      );

      setUploadedAssets(updatedAssets);
      setStep(ImportStep.UPLOAD);
    } catch (error) {
      console.error('Failed to fix textures:', error);
    } finally {
      setIsFixingTextures(false);
    }
  }, [uploadedAssets, setUploadedAssets]);

  const handleScreenshot = useCallback(
    (file: Asset) => (thumbnail: string) => {
      const { name } = file.blob;
      setScreenshots(prev => (prev[name] ? prev : { ...prev, [name]: thumbnail }));
    },
    [],
  );

  const handleNameChange = useCallback(
    (fileIdx: number) => (newName: string) => {
      setUploadedAssets(prev =>
        prev.map((asset, i) => (i === fileIdx ? { ...asset, name: newName } : asset)),
      );
    },
    [setUploadedAssets],
  );

  const manyAssets = uploadedAssets.length > 1;
  const countText = `${slide + 1}/${uploadedAssets.length}`;
  const importText = isImporting
    ? 'IMPORTING...'
    : `IMPORT${manyAssets ? ` ALL (${uploadedAssets.length})` : ''}`;

  const allScreenshotsTaken = useMemo(() => {
    const neededScreenshots = uploadedAssets.filter($ => {
      const type = determineAssetType($.extension);
      return type === 'Models' || type === 'Images';
    });
    return neededScreenshots.length === Object.keys(screenshots).length;
  }, [uploadedAssets, screenshots]);

  const isNameUnique = useCallback(
    (asset: Asset) => !invalidNames.has(formatFileName(asset)),
    [invalidNames],
  );

  const invalidAssets = useMemo(() => {
    return uploadedAssets
      .filter(asset => invalidNames.has(formatFileName(asset)))
      .map(asset => ({
        ...asset,
        error: { type: 'name' },
      })) as Asset[];
  }, [uploadedAssets, invalidNames]);

  const invalidAssetsErrorMessage =
    invalidAssets.length > 1
      ? 'These assets already exist in your Assets folder'
      : 'This asset already exists in your Assets folder';

  if (!uploadedAssets.length) return null;

  return (
    <>
      {step === ImportStep.UPLOAD && (
        <div className="Slider">
          <h2>Import Assets</h2>
          {manyAssets && <span className="counter">{countText}</span>}
          <AssetSlides
            uploadedAssets={uploadedAssets}
            currentSlide={slide}
            onSlideChange={setSlide}
            onScreenshot={handleScreenshot}
            onNameChange={handleNameChange}
            isNameUnique={isNameUnique}
          />
          <Button
            type="danger"
            size="big"
            onClick={handleConfirmImport}
            disabled={!allScreenshotsTaken || isImporting}
          >
            {importText}
          </Button>
        </div>
      )}
      {step === ImportStep.TEXTURE_WARNINGS && (
        <TextureWarnings
          textureIssues={textureIssues}
          isFixing={isFixingTextures}
          onFix={handleFixTextures}
          onBack={() => setStep(ImportStep.UPLOAD)}
        />
      )}
      {step === ImportStep.CONFIRM && (
        <>
          <h2>Replace Assets?</h2>
          <Error
            assets={invalidAssets}
            errorMessage={invalidAssetsErrorMessage}
            primaryAction={{ name: 'Replace', onClick: handleSubmit }}
            secondaryAction={{ name: 'Back', onClick: () => setStep(ImportStep.UPLOAD) }}
          />
        </>
      )}
    </>
  );
}
