import { bindable } from 'aurelia-framework'
import { CoverData } from './app'

export class Cover {
    @bindable
    coverData: CoverData
}
