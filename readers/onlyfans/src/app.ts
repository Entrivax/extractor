import { PLATFORM } from 'aurelia-pal';
import { Router, RouterConfiguration } from "aurelia-router"

export class App {
    router: Router

    configureRouter(config: RouterConfiguration, router: Router): void {
        this.router = router;
        config.map([
            { route: '', name: 'feed', moduleId: PLATFORM.moduleName('Feed') }
        ]);
    }
}
