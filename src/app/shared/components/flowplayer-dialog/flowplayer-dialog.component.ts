import { Component, Inject, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { FlowplayerComponent } from '../flowplayer/flowplayer.component'; // Import the player
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

export interface FlowplayerDialogData {
    streamUrl: string;
    title?: string;
    token?: string; // Pass token if needed, though ideally component handles its default/placeholder
}

@Component({
    selector: 'app-flowplayer-dialog',
    templateUrl: './flowplayer-dialog.component.html',
    styleUrls: ['./flowplayer-dialog.component.scss'],
    standalone: true,
    imports: [
        MatDialogModule,
        FlowplayerComponent, // Embed the FlowplayerComponent
        MatIconModule,
        MatButtonModule,
    ],
})
export class FlowplayerDialogComponent {
    public readonly dialogRef = inject(MatDialogRef<FlowplayerDialogComponent>);
    constructor(@Inject(MAT_DIALOG_DATA) public data: FlowplayerDialogData) {}

    closeDialog(): void {
        this.dialogRef.close();
    }
}
