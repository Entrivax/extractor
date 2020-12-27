import { bindable } from 'aurelia-framework'
import { CoverData } from './Feed'

export class Cover {
    @bindable
    coverData: CoverData
}
