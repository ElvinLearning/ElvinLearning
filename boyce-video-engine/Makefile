EP ?= ep001

.PHONY: help install validate cost plan generate contact assemble variants check

help:
	@echo "make validate EP=ep001   check an episode before spending anything"
	@echo "make cost     EP=ep001   estimate the bill"
	@echo "make plan     EP=ep001   print prompts, generate nothing"
	@echo "make generate EP=ep001   render candidate takes"
	@echo "make contact  EP=ep001   contact sheet of every take"
	@echo "make assemble EP=ep001   master.mp4 + editable fcpxml"
	@echo "make variants EP=ep001   plan the A-E published cuts"
	@echo "make check               validate every episode in the repo"

install:
	pip install -r requirements.txt

validate: ; python -m engine.cli validate $(EP)
cost:     ; python -m engine.cli cost $(EP)
plan:     ; python -m engine.cli generate $(EP) --dry-run
generate: ; python -m engine.cli generate $(EP)
contact:  ; python -m engine.cli contact $(EP)
assemble: ; python -m engine.cli assemble $(EP)
variants: ; python -m engine.cli variants $(EP)

check:
	@for f in episodes/*.json; do echo "--- $$f"; python -m engine.cli validate $$f || true; done
