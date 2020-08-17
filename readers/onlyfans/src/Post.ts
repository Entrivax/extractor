import { bindable } from 'aurelia-framework'
import { Creator } from 'app'
export class Post {
    @bindable
    post: any

    @bindable
    creator: Creator
}
