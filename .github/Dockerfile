# Dockerfile to speed up github actions CI runs

# podman build -t ghcr.io/mapforge-org/mapforge-ci-runner:latest 
# echo 'token' | podman login ghcr.io -u mapforge-org --password-stdin
# podman push ghcr.io/mapforge-org/mapforge-ci-runner:latest

FROM ubuntu:22.04

LABEL org.opencontainers.image.source https://github.com/mapforge-org/mapforge

RUN apt-get update && apt-get install -y \
    build-essential \
    libproj-dev \
    proj-bin \
    libimlib2 \
    libimlib2-dev \
    ruby-dev \
    git \ 
    libvips \ 
    pkg-config \
    imagemagick \
    && apt-get clean

# Set working directory
WORKDIR /github/workspace