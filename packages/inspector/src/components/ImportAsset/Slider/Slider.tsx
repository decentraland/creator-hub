import { useCallback, useMemo, useState } from 'react';

import { Error } from '../Error';
import { Button } from '../../Button';
import type { Asset } from '../types';
import { determineAssetType, formatFileName } from '../utils';
import { AssetSlides } from './AssetSlides';
import { useSliderAssets } from './useSliderAssets';
import type { PropTypes, Thumbnails } from './types';

import './Slider.css';

enum ImportStep {
  UPLOAD = 'upload',
  CONFIRM = 'confirm',
}

export function Slider({ assets, onSubmit, isNameAvailable, isImporting = false }: PropTypes) {
  const { assets: uploadedAssets, setAssets: setUploadedAssets } = useSliderAssets(assets);
  const [slide, setSlide] = useState(0);
  const [screenshots, setScreenshots] = useState<Thumbnails>({});
  const [step, setStep] = useState<ImportStep>(ImportStep.UPLOAD);

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

  const handleSubmit = useCallback(() => {
    onSubmit(
      uploadedAssets.map($ => ({
        ...$,
        thumbnail: screenshots[$.blob.name],
      })),
    );
  }, [uploadedAssets, screenshots, onSubmit]);

  const handleConfirmImport = useCallback(() => {
    if (invalidNames.size > 0) {
      setStep(ImportStep.CONFIRM);
    } else {
      handleSubmit();
    }
  }, [invalidNames, handleSubmit]);

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
