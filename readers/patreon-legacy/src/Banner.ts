import { bindable } from 'aurelia-framework'
import { BannerData } from './app'

export class Banner {
    @bindable
    data: BannerData
}
