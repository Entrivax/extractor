import { Aurelia } from 'aurelia-framework'
import * as environment from '../config/environment.json'
import { PLATFORM } from 'aurelia-pal'
import 'tippy.js/dist/tippy.css';

export function configure (aurelia: Aurelia) {
    aurelia.use
        .standardConfiguration()
        .feature(PLATFORM.moduleName('resources/index'))
        .plugin(PLATFORM.moduleName('aurelia-dialog'), config => {
            config
                .useDefaults()
                .useCSS('')
        })

    aurelia.use.developmentLogging(environment.debug ? 'debug' : 'warn')

    if (environment.testing) {
        aurelia.use.plugin(PLATFORM.moduleName('aurelia-testing'))
    }

    let viewToUse = PLATFORM.moduleName('feed-view/app') // default case

    if ((window as any).onlyFansData !== undefined) {
        viewToUse = PLATFORM.moduleName('feed-view/app')
    } else if ((window as any).onlyFansMessagesData !== undefined) {
        viewToUse = PLATFORM.moduleName('messages-view/app')
    }

    aurelia.start().then(() => aurelia.setRoot(viewToUse))
}
