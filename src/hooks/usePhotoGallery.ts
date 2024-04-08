import { useEffect, useState } from "react";
import { isPlatform } from "@ionic/react";
import {
  Camera,
  CameraResultType,
  CameraSource,
  Photo,
} from "@capacitor/camera";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

const PHOTO_STORAGE = 'photos'
export function usePhotoGallery() {
  const [photos, setPhotos] = useState<UserPhoto[]>([]);

  const savePicture = async (photo: Photo,
    fileName: string): Promise<UserPhoto> => {

      let base64Data: string | Blob;
      // "hybrid" will detect Cordova or Capacitor;
      if (isPlatform('hybrid')) {
        const file = await Filesystem.readFile({
          path: photo.path!,
        });
        base64Data = file.data;
      } else {
        base64Data = await base64FromPath(photo.webPath!);
      }
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Data,
      });
      if(isPlatform('hybrid')) {
        return {
          filepath: savedFile.uri,
          webviewPath: Capacitor.convertFileSrc(savedFile.uri),
        };
      } else {
        return {
          filepath: fileName,
          webviewPath: photo.webPath,
        };
      }

  };
  
  useEffect(() => {
    const loadSaved = async () => {
      const { value } = await Preferences.get({ key: PHOTO_STORAGE });
    
      const photosInPreferences = (value ? JSON.parse(value) : []) as UserPhoto[];
      // If running on the web...
      if (!isPlatform('hybrid')) {
        for (let photo of photosInPreferences) {
          const file = await Filesystem.readFile({
            path: photo.filepath,
            directory: Directory.Data,
          });
          // Web platform only: Load the photo as base64 data
          photo.webviewPath = `data:image/jpeg;base64,${file.data}`;
        }
      }
      setPhotos(photosInPreferences);
    };
    loadSaved();
  }, []);

  const takePhoto = async () => {
    try {
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
        quality: 100,
      });

      const fileName = Date.now() + ".jpeg";
      const savedFileImage = await savePicture(photo, fileName);
      const newPhotos = [savedFileImage, ...photos];
      setPhotos(newPhotos);
      Preferences.set({ key: PHOTO_STORAGE, value: JSON.stringify(newPhotos) });
    } catch (error) {
      console.error("Error taking photo:", error);
    }
  };

  return {
    photos,
    takePhoto,
  };
}

export interface UserPhoto {
  filepath: string;
  webviewPath?: string;
}

async function base64FromPath(path: string): Promise<string> {
  const response = await fetch(path);
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject("Method did not return a string");
      }
    };
    reader.readAsDataURL(blob);
  });
}
