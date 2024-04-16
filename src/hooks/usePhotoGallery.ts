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

// Constant for defining the key for storing photos in preferences
const PHOTO_STORAGE = 'photos'
export function usePhotoGallery() {
    // State variable for storing photos
  const [photos, setPhotos] = useState<UserPhoto[]>([]);

  // Function for saving a picture to filesystem
  const savePicture = async (photo: Photo,
    fileName: string): Promise<UserPhoto> => {

      let base64Data: string | Blob;
        // Check if running on hybrid platform
      if (isPlatform('hybrid')) {
        const file = await Filesystem.readFile({
          path: photo.path!,
        });
        base64Data = file.data;
      } else {
        // For web platform, convert webPath to base64
        base64Data = await base64FromPath(photo.webPath!);
      }
       // Write the file to filesystem
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Data,
      });

      // Return file paths based on platform
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
    
  // Load saved photos from preferences on component mount
  useEffect(() => {
    const loadSaved = async () => {
      const { value } = await Preferences.get({ key: PHOTO_STORAGE });

     // Parse saved photos from preferences
      const photosInPreferences = (value ? JSON.parse(value) : []) as UserPhoto[];

       // If running on the web, load photos as base64 data
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
       // Set photos state with loaded photos
      setPhotos(photosInPreferences);
    };
    loadSaved();
  }, []);

   // Function for taking a photo
  const takePhoto = async () => {
    try {
        // Use Capacitor Camera plugin to take a photo
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
        quality: 100,
      });

      const fileName = Date.now() + ".jpeg";
       // Save the taken photo to filesystem
      const savedFileImage = await savePicture(photo, fileName);
        // Update photos state with the new photo
      const newPhotos = [savedFileImage, ...photos];
      setPhotos(newPhotos);
      // Save updated photos to preferences
      Preferences.set({ key: PHOTO_STORAGE, value: JSON.stringify(newPhotos) });
    } catch (error) {
      console.error("Error taking photo:", error);
    }
  };
  // Return photos state and takePhoto function
  return {
    photos,
    takePhoto,
  };
}

export interface UserPhoto {
  filepath: string;
  webviewPath?: string;
}

// Function for converting file path to base64
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
