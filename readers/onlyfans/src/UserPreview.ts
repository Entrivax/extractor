import { User } from './app';
import { bindable } from 'aurelia-framework'

export class UserPreview {
    @bindable
    user: User
}
