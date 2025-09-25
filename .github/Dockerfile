# Dockerfile to speed up github actions CI runs

# podman build -t ghcr.io/mapforge-org/mapforge-ci-runner:latest .
# echo 'token' | podman login ghcr.io -u mapforge-org --password-stdin
# podman push ghcr.io/mapforge-org/mapforge-ci-runner:latest

FROM ubuntu:22.04

LABEL org.opencontainers.image.source https://github.com/mapforge-org/mapforge

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && \
    echo "tzdata tzdata/Areas select Etc" | debconf-set-selections && \
    echo "tzdata tzdata/Zones/Etc select UTC" | debconf-set-selections && \
    apt-get install -y  \
    build-essential \
    libproj-dev \
    proj-bin \
    libimlib2 \
    libimlib2-dev \
    libyaml-dev \
    ruby-dev \
    git \
    libvips \
    pkg-config \
    imagemagick \
    tzdata \
    && apt-get clean

# Set working directory
WORKDIR /github/workspace