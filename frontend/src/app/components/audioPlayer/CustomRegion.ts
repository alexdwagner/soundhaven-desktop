import { Marker } from "../../../../shared/types";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions";
import { RegionParams } from "wavesurfer.js/src/plugin/regions";
import WaveSurfer from "wavesurfer.js";

export class CustomRegionWrapper {
  private region: any;
  public data: Marker;
  private onSelect: (marker: Marker) => void; // Callback when the region is selected

  constructor(region: any, data: Marker, onSelect: (marker: Marker) => void) {
      this.region = region;
      this.data = data;
      this.onSelect = onSelect;

      // Listen for click events on the region
      this.region.element.addEventListener('click', this.handleRegionClick);
  }

  private handleRegionClick = (): void => {
      this.onSelect(this.data); // Notify that this region's data was selected
  };

  public highlight(): void {
      this.region.update({ color: 'rgba(255, 215, 0, 0.7)' });
  }

  // Cleanup if needed
  public destroy() {
      this.region.element.removeEventListener('click', this.handleRegionClick);
  }
}
