VERSION ?= $(shell git describe --tags --always --dirty --match='v*' || echo 'dev')
IMAGE_NAME ?= zenfeed-web
REGISTRY ?= glidea
FULL_IMAGE_NAME = $(REGISTRY)/$(IMAGE_NAME)

.PHONY: push

push:
	docker-buildx create --use --name multi-platform-builder || true
	docker-buildx build --platform linux/amd64,linux/arm64 \
		-t $(FULL_IMAGE_NAME):$(VERSION) \
		-t $(FULL_IMAGE_NAME):latest \
		--push .
