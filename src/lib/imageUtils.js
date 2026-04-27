/**
 * Compresses an image file in the browser before upload.
 * Resizes the image to fit within maxWidth/maxHeight and outputs as JPEG.
 * @param {File} file - The original image file
 * @param {number} maxWidth - Maximum width
 * @param {number} maxHeight - Maximum height
 * @param {number} quality - JPEG compression quality (0.0 to 1.0)
 * @returns {Promise<File>} The compressed image file
 */
export async function compressImage(file, maxWidth = 256, maxHeight = 256, quality = 0.6) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.match(/image.*/)) {
      reject(new Error("File must be an image"));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions maintaining aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round(height * (maxWidth / width));
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round(width * (maxHeight / height));
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        // Fill white background in case of transparent png
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Canvas toBlob failed"));
              return;
            }
            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
              type: 'image/jpeg',
              lastModified: Date.now()
            });
            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => reject(new Error("Image load failed"));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

export function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('Missing file'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result);
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}

export function getCropLayout(
  imageWidth,
  imageHeight,
  frameSize,
  zoom = 1,
  offsetX = 0,
  offsetY = 0
) {
  const safeWidth = Math.max(Number(imageWidth || 0), 1);
  const safeHeight = Math.max(Number(imageHeight || 0), 1);
  const safeFrame = Math.max(Number(frameSize || 0), 1);
  const safeZoom = Math.max(Number(zoom || 1), 1);
  const normalizedOffsetX = Math.max(Math.min(Number(offsetX || 0), 100), -100) / 100;
  const normalizedOffsetY = Math.max(Math.min(Number(offsetY || 0), 100), -100) / 100;

  const baseScale = Math.max(safeFrame / safeWidth, safeFrame / safeHeight);
  const width = safeWidth * baseScale * safeZoom;
  const height = safeHeight * baseScale * safeZoom;
  const centeredLeft = (safeFrame - width) / 2;
  const centeredTop = (safeFrame - height) / 2;
  const panLimitX = Math.abs(safeFrame - width) / 2;
  const panLimitY = Math.abs(safeFrame - height) / 2;

  return {
    width,
    height,
    left: centeredLeft + normalizedOffsetX * panLimitX,
    top: centeredTop + normalizedOffsetY * panLimitY
  };
}

export async function cropImageToFile(
  source,
  fileName = 'profile.jpg',
  {
    outputSize = 600,
    zoom = 1,
    offsetX = 0,
    offsetY = 0,
    quality = 0.9
  } = {}
) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = outputSize;
      canvas.height = outputSize;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context unavailable'));
        return;
      }

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, outputSize, outputSize);

      const layout = getCropLayout(
        image.width,
        image.height,
        outputSize,
        zoom,
        offsetX,
        offsetY
      );

      ctx.drawImage(image, layout.left, layout.top, layout.width, layout.height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Canvas toBlob failed'));
            return;
          }

          resolve(
            new File([blob], fileName.replace(/\.[^/.]+$/, '.jpg'), {
              type: 'image/jpeg',
              lastModified: Date.now()
            })
          );
        },
        'image/jpeg',
        quality
      );
    };
    image.onerror = () => reject(new Error('Image load failed'));
    image.src = source;
  });
}
