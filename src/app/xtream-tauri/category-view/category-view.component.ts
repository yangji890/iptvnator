import {
    ChangeDetectionStrategy,
    Component,
    HostBinding,
    input,
    output,
} from '@angular/core';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { TranslatePipe } from '@ngx-translate/core';
import { XtreamCategory } from '../../../../shared/xtream-category.interface';
import { PlaylistErrorViewComponent } from '../playlist-error-view/playlist-error-view.component';

@Component({
    selector: 'app-category-view',
    imports: [
        MatListModule,
        MatChipsModule, // Added MatChipsModule
        PlaylistErrorViewComponent,
        TranslatePipe,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './category-view.component.html',
    styleUrls: ['./category-view.component.scss'],
})
export class CategoryViewComponent {
    readonly items = input([]);
    readonly selectedCategoryId = input<number>();
    readonly layout = input<'vertical' | 'horizontal'>('vertical');

    readonly categoryClicked = output<XtreamCategory>();

    @HostBinding('class.horizontal-layout') get isHorizontal() {
        return this.layout() === 'horizontal';
    }

    @HostBinding('class.vertical-layout') get isVertical() {
        return this.layout() === 'vertical';
    }

    isSelected(item: XtreamCategory): boolean {
        const selectedCategory = this.selectedCategoryId();
        const itemId = (item as any).category_id ?? item.id;

        return (
            selectedCategory !== null &&
            String(selectedCategory) === String(itemId)
        );
    }
}
