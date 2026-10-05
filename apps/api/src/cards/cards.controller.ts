import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { ActivateCardDto, IssueCardDto, UpdateCardControlsDto } from './cards.dto';
import { CardsService } from './cards.service';

@Controller('cards') @UseGuards(JwtAuthGuard)
export class CardsController {
  constructor(private readonly cards: CardsService) {}
  @Get() list(@CurrentUser() user: AuthenticatedUser) { return this.cards.list(user.id); }
  @Post() issue(@CurrentUser() user: AuthenticatedUser, @Body() dto: IssueCardDto) { return this.cards.issue(user.id, dto); }
  @Post(':id/activate') activate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ActivateCardDto) { return this.cards.activate(user.id, id, dto); }
  @Post(':id/freeze') freeze(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.cards.freeze(user.id, id, true); }
  @Post(':id/unfreeze') unfreeze(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.cards.freeze(user.id, id, false); }
  @Patch(':id/controls') controls(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateCardControlsDto) { return this.cards.controls(user.id, id, dto); }
  @Get(':id/transactions') transactions(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.cards.transactions(user.id, id); }
  @Post(':id/replace') replace(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.cards.replace(user.id, id); }
}
