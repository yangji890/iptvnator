import { Component, inject, OnInit } from '@angular/core';
import { CategoryViewComponent } from './category-view/category-view.component';

import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { XtreamCategory } from '../../../shared/xtream-category.interface';
import { MpvPlayerBarComponent } from '../shared/components/mpv-player-bar/mpv-player-bar.component';
import { XtreamStore } from './xtream.store';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { LanguageSwitcherComponent } from '../shared/components/language-switcher/language-switcher.component'; // Import LanguageSwitcher

@Component({
    selector: 'app-xtream-main-container',
    templateUrl: './xtream-main-container.component.html',
    styleUrls: ['./xtream-main-container.component.scss', './sidebar.scss'],
    imports: [
        CategoryViewComponent,
        TranslateModule,
        RouterOutlet,
        MpvPlayerBarComponent,
        MatIcon,
        MatIconButton,
        MatFormFieldModule,
        MatInputModule,
        LanguageSwitcherComponent, // Add LanguageSwitcherComponent to imports
    ],
})
export class XtreamMainContainerComponent implements OnInit {
    readonly router = inject(Router);
    readonly route = inject(ActivatedRoute);
    readonly xtreamStore = inject(XtreamStore);

    readonly categories = this.xtreamStore.getCategoriesBySelectedType;

    readonly selectedCategoryId = this.xtreamStore.selectedCategoryId;

    ngOnInit(): void {
        const { categoryId } = this.route.snapshot.params;
        if (categoryId)
            this.xtreamStore.setSelectedCategory(Number(categoryId));
    }

    categoryClicked(category: XtreamCategory) {
        const categoryId = (category as any).category_id ?? category.id;
        this.xtreamStore.setSelectedCategory(Number(categoryId));

        // Navigate to the category content view which should be a child route
        this.router.navigate(['categories', categoryId], {
            relativeTo: this.route.parent, // Navigate relative to parent if this is a child, or adjust as needed
        });
    }

    getContentLabel(): string {
        const selectedCategory = this.xtreamStore.getSelectedCategory();
        if (!selectedCategory) {
            // Check if we are on a search results page or other non-category specific view
            if (this.router.url.includes('search')) {
                return 'Search Results'; // Or a translated string
            }
            return 'All Categories'; // Default label or translated
        } else {
            return (selectedCategory as any).name || 'Category Content';
        }
    }

    historyBack() {
        // This might need adjustment based on where search results are displayed
        // If search is a separate route, this logic might be fine.
        // If search overlays or replaces category content, ensure it navigates back correctly.
        const currentCategory = this.xtreamStore.selectedCategoryId();
        if (currentCategory) {
            this.router.navigate(['categories', currentCategory], {
                 relativeTo: this.route.parent, // Adjust as per routing structure
            });
        } else {
            // If no category is selected (e.g. coming from global search to details),
            // navigate to the base route or a sensible default.
            this.router.navigate(['./'], { relativeTo: this.route.parent });
        }
    }

    onSearch(event: Event) {
        const searchTerm = (event.target as HTMLInputElement).value;
        if (searchTerm && searchTerm.trim() !== '') {
            // Navigate to a search results route, passing the search term as a query parameter
            this.router.navigate(['search'], {
                queryParams: { q: searchTerm.trim() },
                relativeTo: this.route.parent, // Or an absolute path depending on your routes
            });
        } else if (searchTerm.trim() === '') {
            // If search is cleared, navigate back to the current category or a default view
            const currentCategory = this.xtreamStore.selectedCategoryId();
            if (currentCategory) {
                 this.router.navigate(['categories', currentCategory], {
                    relativeTo: this.route.parent,
                });
            } else {
                // Navigate to a default view, e.g., the first category or home
                this.router.navigate(['./'], { relativeTo: this.route.parent });
            }
        }
        // The actual search logic will be in the SearchResultsComponent (Plan Step 2)
        console.log('Search term:', searchTerm);
    }
}
