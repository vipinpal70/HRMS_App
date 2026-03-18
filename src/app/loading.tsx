import { Mosaic } from "react-loading-indicators";

export default function Loading() {
  return (
    <div className="min-h-[60vh] w-full flex justify-center items-center">
      <Mosaic color="#f88a10" size="small" text="" textColor="#f88a10" />
    </div>
  );
}
