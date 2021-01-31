import { PLATFORM } from 'aurelia-pal';
import { FrameworkConfiguration } from 'aurelia-framework'

export function configure (config: FrameworkConfiguration) {
    config.globalResources([
        PLATFORM.moduleName('./DurationValueConverter'),
        PLATFORM.moduleName('./FromValueConverter'),
        PLATFORM.moduleName('./PagingValueConverter'),

        // Components
        PLATFORM.moduleName('./components/MediaDisplay'),
    ]);
}
